# Predictive Methods, Data and Evidence for IP Map's Scored Predictions

Scope: methods, features, open data, published accuracy, commercial tools, and how each prediction resolves. Researched 2026-09-28. About 20 tool calls. Vendor claims are kept apart from peer-reviewed or independently checked results. Anything without a source is listed under Gaps.

## 1. Grant probability and final claim scope of pending applications

### Takeaway
Academic grant/no-grant classifiers that use application-level features plus text reach about 0.85 ROC-AUC. Examination narrows claims on average, and it narrows them more when prosecution runs longer or harder. The main commercial tools (LexisNexis PatentAdvisor, Juristat) sell examiner-behavior metrics, not audited per-application probabilities. None of them publishes out-of-sample calibration.

### Cited Findings
- Yao & Ni (Scientometrics 2023, vol. 128(9)) combined patent-level variables with patent text and got **0.854 ROC-AUC and 77% accuracy** for predicting grant. Features: applicant's prior experience, page length, backward citations, claim count, family size, knowledge accumulation, technology complexity, inventor team size, examination duration, scope. They explained the model with SHAP and permutation importance. — [IDEAS/RePEc abstract](https://ideas.repec.org/a/spr/scient/v128y2023i9d10.1007_s11192-023-04736-z.html)
- In the same study, knowledge accumulation and technology complexity have curvilinear (diminishing) effects. Prior experience, family size and use of a patent agent have monotonic positive effects. Narrower claims go with higher grant rates, but more claims also help. Team size, technology range and examination duration had minimal effect. — [IDEAS/RePEc](https://ideas.repec.org/a/spr/scient/v128y2023i9d10.1007_s11192-023-04736-z.html)
- Other ML studies on USPTO grant outcomes report about 75% cross-validated accuracy, using NB, LR, RF, XGBoost, SVM, ANN, CNN and LSTM (search-result summary, not verified against a primary paper). — [Scientometrics/Springer listing via search](https://ideas.repec.org/a/spr/scient/v128y2023i9d10.1007_s11192-023-04736-z.html)
- **Open training data:** the USPTO Patent Examination Research Dataset (PatEx; Graham, Marco & Miller) comes from Public PAIR. It covers more than 9 million applications and includes the transaction/status codes for every applicant and examiner action, plus examiner, attorney and applicant fields. — [USPTO PatEx working paper](https://www.uspto.gov/sites/default/files/documents/PatEx%20Working%20Paper.pdf); [SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2702637)
- USPTO OCE also publishes an Office Action research dataset (rejection types such as 101/102/103/112 and cited prior art, pulled from OA text). — [Patently-O hosted USPTO paper](https://patentlyo.com/media/2017/11/USPTO-Patent-Prosecution-Research-Data_Unlocking-Office-Action-Traits-1.pdf)
- **Claim narrowing:** examination narrows patent scope compared with scope at filing, and the change is larger when examination lasts longer or is more intensive. — [Research Policy, "Patent claims and patent scope"](https://www.sciencedirect.com/science/article/abs/pii/S0048733319301052)
- Examiner heterogeneity is a real feature: Righi & Simcoe document examiner specialization (NBER w23913). Frakes & Wasserman used PatEx for work on examiner characteristics and grant behavior. — [NBER w23913](https://www.nber.org/system/files/working_papers/w23913/w23913.pdf); [Semantic Scholar PatEx](https://www.semanticscholar.org/paper/The-USPTO-Patent-Examination-Research-Dataset:-A-on-Graham-Marco/5d0eb489c255ae78e882b8a99af7d8b9fbf2ad92)
- **Vendor claim (unverified):** LexisNexis PatentAdvisor sells "Examiner ETA" (Examiner Time Allocation) as "more reliable" than raw allowance rate. It is computed from all of an examiner's applications, including pending ones, and adjusts for experience and trend. Its stated reason is that raw allowance rate lumps applicant-driven abandonment together with examiner rejection. No accuracy figure is published. — [LexisNexis IP](https://www.lexisnexisip.com/resources/three-reasons-patentadvisor-examiner-eta-is-better-than-allowance-rate/)
- **Vendor (unverified):** Juristat sells examiner and art-unit allowance rates, OA counts, appeal and interview statistics, and says these "predict examiner behavior". No published calibration. — [Juristat blog](https://blog.juristat.com/predicting-examiner-behavior); [Juristat examiner analytics](https://juristat.com/analytics/examiner-analytics)

### Inferences
- A defensible baseline is a gradient-boosted model on PatEx/PEDS status history (OA count and type, RCEs, interviews, time since filing) with examiner and art-unit prior allowance rates as features. Those rates must be computed **as-of** the prediction date, including pending cases and leaving out applicant-driven abandonments (the ETA logic).
- Claim scope can be proxied at filing and at grant by independent-claim word count and the number of independent claims, then diffed. The Research Policy result supports "more OAs/RCEs → more narrowing" as a prior.
- **Resolves:** a Notice of Allowance, then issuance (grant = 1), or abandonment (0), both in PEDS/Patent Center. The scope prediction resolves on the issued claims. Horizon is 1–4 years. **Metrics:** Brier score and a reliability diagram for P(grant). AUC for ranking. MAE on the change in independent-claim word count for scope.

### Gaps
- Neither vendor publishes per-application prediction accuracy or calibration. PatentBots methodology was not found.
- I did not find a biotech-specific (TC 1600) grant-prediction accuracy figure.
- The PatEx snapshot referenced here is complete as of Jan 2015. For current data, PEDS was retired into the Open Data Portal (status not verified in this pass).

## 2. Generic/biosimilar entry date as a probability distribution

### Takeaway
Rule-based "expected entry" methods from Orange Book patents and exclusivities work for active-ingredient patents. They fail badly for drugs protected only by secondary patents, which are the Paragraph IV/settlement cases. Only 59% of top drugs saw generic entry inside the predicted window. Biosimilars carry an extra US-specific lag: an average of about 34 months from FDA approval to launch.

### Cited Findings
- Rome/Kesselheim et al. (Value in Health 2018) back-tested a rule-based method on **170 top-selling drugs that lost exclusivity 2000–2012** (Medicaid data). Median predicted exclusivity was 12.5 years (IQR 7.25–14.5) against 12.5 actual (IQR 8.5–14.75). **59% entered within the expected window, 23% late, 18% early.** — [Value in Health](https://www.valueinhealthjournal.com/article/S1098-3015(18)32154-5/fulltext); [PubMed](https://pubmed.ncbi.nlm.nih.gov/30502781/)
- Accuracy by patent type: for drugs with active-ingredient patents (77%), predicted median was 12.25 years against 13.0 actual. For drugs with **only secondary patents (22%), predicted median was 16.0 years against 8.25 actual.** Secondary patents are usually challenged or settled away. — [Value in Health](https://www.valueinhealthjournal.com/article/S1098-3015(18)32154-5/fulltext)
- Hemphill & Sampat (J. Health Econ. 2012): effective market life (brand approval to first generic) averaged about **12.2 years** and was stable over 2001–2010. Paragraph IV challenges were more common for high-sales drugs, and early challenges increased. Of 125 NMEs, 78 had challenges, and only 27 of those targeted an active-ingredient patent. — [PubMed](https://pubmed.ncbi.nlm.nih.gov/22425766/); [SSRN](https://doi.org/10.2139/ssrn.1830404); [BIO comment summarizing](https://downloads.regulations.gov/PTO-P-2022-0037-0082/attachment_1.pdf)
- A follow-on method, "Approximating Future Generic Entry for New Drugs", appeared in J. Law, Medicine & Ethics. — [Cambridge Core](https://www.cambridge.org/core/journals/journal-of-law-medicine-and-ethics/article/abs/approximating-future-generic-entry-for-new-drugs/56765AF1008397172510060B253281D9)
- Settlement regime: after FTC v. Actavis (2013), settlements that paired a payment to the generic with an entry restriction fell sharply in FTC filings and **reached zero in FY2021**. The first filer's 180-day exclusivity can "cork the bottle" for later filers. — [FDA Law Blog](https://www.thefdalawblog.com/2021/04/the-fifth-circuit-addresses-pay-for-delay-agreements-money-for-nothing-and-patent-settlements-for-free/); [FTC pay-for-delay study](https://www.ftc.gov/sites/default/files/documents/reports/pay-delay-how-drug-company-pay-offs-cost-consumers-billions-federal-trade-commission-staff-study/100112payfordelayrpt.pdf); [Actavis, Justia](https://supreme.justia.com/cases/federal/us/570/136/)
- Academic evidence on Paragraph IV settlement vs. litigated outcomes (J. Law & Econ.) — [UNC-hosted paper](https://jonwms.web.unc.edu/wp-content/uploads/sites/10989/2021/06/ParIVSettlements_JLE.pdf)
- At-risk launch tail risk: Apotex's 2006 at-risk launch of generic Plavix led to a $442M judgment (vendor blog, secondary source). — [DrugPatentWatch](https://www.drugpatentwatch.com/blog/the-at-risk-launch-damages-model-still-runs-on-2015-math/)
- **Biosimilars:** the average US lag from approval to launch is **about 34 months, against 7.4 in Canada and 4.7 in the UK**. About 9x more patents were asserted in the US than in Canada and 12x more than in the UK, across the same 30 biosimilars (Goode & Chao, J. Law & Biosciences 2022). — [Oxford Academic JLB](https://academic.oup.com/jlb/article/9/2/lsac022/6680093); [Legis1 summary](https://legis1.com/news/biosimilar-patent-thickets-us-delay-access-years)
- Most biosimilar patent lawsuits involve patents filed about a decade after the originator's approval. — [AJMC](https://www.ajmc.com/view/patents-filed-a-decade-post-originator-approval-account-for-most-biosimilar-patent-lawsuits)
- BPCIA structure: 12-year reference exclusivity, plus a 180-day notice of commercial marketing after approval (Federal Circuit reading, per SEC risk factors). — [Coherus S-1/A](https://www.sec.gov/Archives/edgar/data/0001512762/000119312515111718/d892693ds1a.htm)
- **Vendor (unverified):** DrugPatentWatch argues entry should be modeled as waves of multi-source entry, not as one date. — [DrugPatentWatch](https://www.drugpatentwatch.com/blog/stop-budgeting-for-generic-entry-as-a-single-date-multi-source-entry-happens-in-waves/)

### Inferences
- Model a distribution: a mixture over (a) the latest-expiring active-ingredient patent plus PTE plus pediatric exclusivity, (b) the 30-month-stay end, (c) settlement-licensed entry dates, which cluster before secondary-patent expiry, and (d) at-risk launch. The Value in Health result shows that a point estimate at the latest Orange Book expiry is biased late for secondary-only drugs by about 8 years at the median.
- Open inputs: Orange Book (patents, exclusivities, historical files), the FDA Paragraph IV certifications list, FDA first-generic approvals, the Purple Book, PACER/Docket Navigator for 30-month stays and settlements, and FTC MMA settlement reports (aggregate only).
- **Resolves:** first ANDA/biosimilar approval plus actual commercial launch (a press release or first NDC listing, or Medicaid/SSR sales data). This takes years. Score with **CRPS or log-score on the date distribution**, plus the pinball loss at the P10/P50/P90 quantiles and interval coverage (does 80% of outcomes land inside the 80% interval?).

### Gaps
- I found no peer-reviewed machine-learning LOE model with published accuracy beyond the Value in Health rule-based backtest.
- No up-to-date count of at-risk launches or FTC FY2022–2025 settlement figures was retrieved.

## 3. PTAB challenge likelihood and outcome

### Takeaway
The PTAB regime changed structurally in 2025–26. IPR institution fell from about 65% (Oct 2024) to about 37% (Feb 2026), and Director-level discretionary denial now decides institution. Any model trained on data from before 2025 needs a regime flag or must be retrained. Among instituted cases, biologic patents have historically fared much worse than Orange Book patents.

### Cited Findings
- IPR institution rate: **about 65% in Oct 2024 and about 37% in Feb 2026, a 43% relative decline.** Denials have outnumbered grants every month since April 2025 except May. About 600 discretionary-consideration decisions were issued after the March 2025 memo. — [IPWatchdog, Apr 8 2026](https://ipwatchdog.com/2026/04/08/uspto-stats-show-ipr-institution-rate-plummeted/)
- By July 2026 the overall institution rate was **30–40%**. Director Squires makes all institution decisions, discretionary and merits, as summary orders. New denial grounds: broader Fintiv, "settled expectations" for long-held patents, RPI disclosure, sovereignty/domestic policy, cross-forum consistency, serial petitions, and a preference for PGR. Ex parte reexam is now **about 75% of post-grant filings, against about 25% for IPR** (mid-2026). — [National Law Review](https://natlawreview.com/article/changes-ptab-and-takeaways-life-sciences-stakeholders)
- Discretionary docket: 681 petitions reviewed, 407 denied (60%), 274 referred to the merits (search-result summary). Separately, an effective institution rate of 38% (314/823) is reported for part of FY2026. — [PTAB Litigation Blog discretionary stats](https://www.ptablitigationblog.com/discretionary-decision-statistics/); [PTAB Litigation Blog FY2026](https://www.ptablitigationblog.com/ptab-statistics-through-two-months-of-fy-2026/)
- Life-sciences history (PTAB's own study): institution rates were 64% overall, **62% for Orange Book patents and 55% for biologic patents**. On FWD outcomes by patent, Orange Book was 45% all claims unpatentable and 50% all claims survived. **Biologics were 70% all claims unpatentable and 24% survived.** Orange Book patents make up about 4% of AIA petitions and biologics about 2%. — [Mintz](https://www.mintz.com/insights-center/viewpoints/2231/2021-08-24-ptab-statistics-show-interesting-trends-orange-book-and); [Finnegan](https://www.finnegan.com/en/insights/articles/key-insights-from-the-ptabs-updated-orange-book-and-biologic-patent-study.html)
- Through March 2023: 19% of challenged Orange Book patents and 7% of biologic patents survived with all claims patentable. 33% of instituted Orange Book claims and 57% of instituted biologic claims were found unpatentable. — [Finnegan / NatLawReview trends](https://natlawreview.com/article/trends-orange-book-and-biologic-ptab-trials)
- Aggregate dispute statistics: Unified Patents' quarterly Patent Dispute Report (Q1 2026). — [Unified Patents](https://www.unifiedpatents.com/insights/2026/4/14/patent-dispute-report-q1-2026); official statistics: [USPTO PTAB statistics](https://www.uspto.gov/patents/ptab/statistics)

### Inferences
- A challenge-likelihood model can use patent age (older patents now draw "settled expectations" denials), parallel litigation or ANDA filings, Orange Book/Purple Book listing, the asset's sales, and prior challenges to the family. Outcome models need a **regime dummy (before and after March 2025)**, and the target should be split into P(petition), P(institution | petition) and P(claims cancelled | instituted).
- **Resolves:** an institution decision (about 6 months after filing) and a final written decision (about 12 months after institution), published in PTAB E2E / the Open Data Portal. Score with Brier score per stage. Because base rates drift, recalibrate on a rolling window.

### Gaps
- I found no peer-reviewed ML paper with a published AUC for predicting IPR institution or outcome. Lex Machina and Docket Navigator methodology or accuracy was not retrieved.
- Life-sciences institution rates after 2025 were not found. NatLawReview says the regime "benefits life sciences patent owners" but gives no numbers.

## 4. Out-licensing likelihood per asset/company

### Takeaway
The best-established predictor is financing conditions. Biotechs partner more, and on worse terms, when equity windows are closed. Evidence at the asset level (phase transitions, runway) is mostly practitioner or vendor lore. I found no published predictive model with accuracy figures.

### Cited Findings
- Lerner, Shane & Tsai (JFE 2003), 200 biotech alliances 1980–1995: biotechs fund R&D through alliances more when public equity financing is scarce. Those deals give more control to the corporate partner, succeed significantly less often, and are more often renegotiated when markets recover. — [SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=227597); [Harvard/Tsai](https://scholar.harvard.edu/atsai/publications/do-equity-financing-cycles-matter-evidence-biotechnology-alliances)
- Danzon, Epstein & Nicholson (MDE 2007): **small biotech M&A acts as an exit for financially distressed firms**, marked by low Tobin's q, few marketed products and low cash-to-sales ratios. This is directly transferable as a partnering and exit feature. — [SSRN](https://doi.org/10.2139/ssrn.468301); [NBER w10536](https://www.nber.org/system/files/working_papers/w10536/w10536.pdf)
- Deal economics by stage: across 916 commercial licenses vs. 239 academic ones, commercial licenses had a median royalty of 8% (vs 3%), a median deal size of $31.0M (vs $0.9M) and median precommercial payments of $25.4M (vs $1.1M). — [PMC10065281](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10065281/)
- Upfront as a share of total deal value rises with stage: about 8–15% at preclinical, 15–25% at Phase 2 and 25–50% at Phase 3/approved (Ambrosia's own Solidus guide, so internal and not independent). — [Solidus guide](https://solidus.ambrosiaventures.co/guides/biotech-licensing-deal-structure)

### Inferences
- Candidate features: months of cash runway (from 10-Q cash and burn), the equity-window index (biotech IPO/follow-on volume), a recent phase readout, the number of pipeline assets per dollar of cash, whether the asset falls outside the company's lead TA, ex-US rights still available, and prior partnering history. Treat the label as a survival target (hazard of a license within 12/24 months).
- **Resolves:** a licensing press release or 8-K/EX-10 filing (Solidus deal ledger). Horizon 12–24 months. Metrics: Brier score on P(deal within 12 months), and **precision@k / top-k hit rate** for "the k assets most likely to partner this year", since users act on shortlists.

### Gaps
- No academic study found that quantifies runway or phase-transition effects on partnering hazard with effect sizes. This needs a targeted search (e.g., Hsu/Ziedonis, Nicholson-Danzon-McCullough alliance pricing, Pisano).

## 5. Buyer propensity and timing (who licenses or acquires what, and when)

### Takeaway
Among large pharma, anticipated patent expirations and pipeline gaps predict M&A (Danzon et al.; Higgins & Rodriguez's "Desperation Index"). Technological similarity and complementarity from patent portfolios predict acquirer-target pairing, and ML similarity on patent data beats the classic Jaffe cosine. Timing evidence is weaker than propensity evidence.

### Cited Findings
- Danzon, Epstein & Nicholson (MDE 2007): **for large firms, mergers respond to excess capacity from anticipated patent expirations and pipeline gaps.** But mergers had no effect on later growth in enterprise value. — [SSRN](https://doi.org/10.2139/ssrn.468301); [EconPapers](https://econpapers.repec.org/RePEc:nbr:nberwo:10536)
- Higgins & Rodriguez (JFE 2006), 160 pharma acquisitions 1994–2001: firms with falling internal productivity (a higher "Desperation Index") are **more likely to make outsourcing-type acquisitions** to refill pipelines. Acquirer returns are positive on average and higher when the acquirer had prior information access to the target (e.g., via an alliance). — [Semantic Scholar](https://www.semanticscholar.org/paper/The-outsourcing-of-R&D-through-acquisitions-in-the-Higgins-Rodriguez/9bf2f4ec1805bea036ed6d3aa95a0da72f929d22)
- Arroyabe et al. (R&D Management 2021) study patent expiration as a driver of both the acquisition decision and target selection in pharma. — [Wiley](https://onlinelibrary.wiley.com/doi/10.1111/radm.12462); a related empirical paper on the effect of patent cliffs on acquisitions: [Sacred Heart](https://digitalcommons.sacredheart.edu/wcob_fac/400/)
- Across 94 realized acquisitions among 2,082 potential matches in high tech, **both technological similarity and complementarity raise acquisition-match likelihood** (Kavuşan et al. 2022). — [Strategic Organization](https://journals.sagepub.com/doi/10.1177/1476127020919329)
- ML M&A pairing (arXiv 2404.07179): 8,737 firms and 547 M&A deals (2002–2012), with PATSTAT IPC firm-technology bipartite networks and 7,132 technologies. **MASS (a modified Sapling similarity) beat Jaffe similarity on every metric** (F1, AUC-PR, Precision@500, mAP, Hit Ratio@5). For the 123 of 547 deals with zero technology overlap, a LightGCN graph model did best. — [arXiv](https://arxiv.org/html/2404.07179v1)
- Context (press, not evidence): the 2026 patent cliff is about $170B, and the press frames pharma BD as a race for biotech assets. — [CNBC Jan 2026](https://www.cnbc.com/2026/01/07/big-pharma-race-to-snap-up-biotech-assets-as-170-billion-patent-cliff-looms.html); [Pharmaceutical Commerce](https://www.pharmaceuticalcommerce.com/view/patent-cliff-pressure-to-sustain-pharma-momentum-2026)

### Inferences
- Buyer score = (revenue at risk from LOE over the next 3–6 years ÷ revenue) × (TA/mechanism gap in the late-stage pipeline) × (patent-portfolio similarity/complementarity to the asset, MASS-style) × (recent BD cadence). Evaluate as a **ranking**: for each asset that actually transacts, where did the real buyer rank in our list (Hit@5, MRR)? The arXiv paper provides precedent for these metrics.
- Timing: model the hazard of a deal as a function of the years to the buyer's largest LOE. The cited studies back propensity more than exact timing.

### Gaps
- Arroyabe and Sacred Heart effect sizes were not retrieved (paywalled). No published evidence found that a buyer's own patent-filing surges predict its in-licensing targets.

## 6. Cold start for young patents and pending applications

### Takeaway
Text-based importance (KPSS: distinct from prior art but similar to later work) predicts future citations and market value. Age-normalized citation-network centrality (rescaled PageRank) identifies significant patents earlier than raw counts. Patent citation dynamics are slower than those of papers, so early signals are noisy.

### Cited Findings
- Kelly, Papanikolaou, Seru & Taddy (AER: Insights 2021) score patents by textual similarity to earlier vs. later patents. The measure **predicts future citations and correlates strongly with market value**. The data is public on GitHub. — [AEA](https://www.aeaweb.org/articles?id=10.1257%2Faeri.20190499); [GitHub data](https://github.com/KPSS2017/Measuring-Technological-Innovation-Over-the-Long-Run-Extended-Data)
- Caveat: KPSS "importance" uses *subsequent* similarity, so it is not fully available at t=0. The backward-looking half ("novelty" = low similarity to the prior 5 years) can be computed at filing. — [Semantic Scholar](https://www.semanticscholar.org/paper/Measuring-Technological-Innovation-Over-the-Long-Kelly-Papanikolaou/17a1ce2cc90e901e4f6bbc4a7d843dca3f430828)
- Mariani, Medo & Lafond (TFSC 2018), US citation network 1926–2010: **rescaled PageRank (age-normalized) identifies historically significant patents earlier than citation count or plain PageRank.** Patent citation dynamics are much slower than those of papers. — [arXiv 1710.09182](https://arxiv.org/abs/1710.09182); [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0040162517314312)
- Early signals of research success at the firm level ("Citations or dollars?", TFSC 2024). — [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0040162524000040)
- Truncation hazard: Lerner & Seru (RFS 2022) show that truncation of recent grants and citations biases analyses. The biases survive the usual adjustments and correlate with firm characteristics. — [RFS](https://academic.oup.com/rfs/article-abstract/35/6/2667/6324822); [NBER w24053](https://www.nber.org/system/files/working_papers/w24053/w24053.pdf)
- A study adapting ML value prediction from patent indicators (renewables). — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0172219025000316)

### Inferences
- Cold-start features that exist at publication: backward-looking text novelty (KPSS-style), embedding similarity to the company's own portfolio and to top-cited patents in the class, backward-citation overlap with high-value families, family size and number of jurisdictions (a filing-cost signal), claim count, and examiner-added citations once the first OA arrives. Update with early citation velocity, normalized for age and class.
- **Resolves:** forward citations at 3/5 years (a percentile within cohort and class), maintenance-fee payment at 3.5/7.5/11.5 years (a cheap public value signal), litigation, and Orange Book/Purple Book listing. Metric: Spearman rank correlation and precision@top-decile.

### Gaps
- No quantified AUC or R² for early-citation-velocity models in biotech specifically was retrieved. The effect size of examiner citations as a predictor was not found.

## 7. Competitor entry signals from filing surges

### Takeaway
It is well accepted that patent filings lead clinical programs by years (18-month publication lag, trials typically 5–8 years after the first priority date). But the sources I found are vendor or practitioner writing, not validated forecasting studies.

### Cited Findings
- **Vendor claims (unverified):** applications publish 18 months after priority. A ClinicalTrials.gov entry is typically **5–8 years downstream** of the earliest patent activity on the same molecule. Faster filing in an area signals more R&D investment. — [DrugPatentWatch](https://www.drugpatentwatch.com/blog/how-to-track-competitor-rd-pipelines-through-drug-patent-filings/); [DrugPatentWatch predictive pipeline](https://www.drugpatentwatch.com/blog/the-predictive-pipeline-structuring-drug-development-timelines-with-ai-driven-patent-intelligence/)
- Clarivate markets patent filings as early competitive signals for biopharma (vendor). — [Clarivate](https://clarivate.com/life-sciences-healthcare/blog/the-competitive-signals-hiding-in-plain-sight-for-biopharma/)
- An academic network approach links the pipeline across the global pharma industry (multilayer drug-pipeline network). — [arXiv 2003.04620](https://arxiv.org/pdf/2003.04620)

### Inferences
- Define a surge as an anomaly in the monthly count of published applications per (assignee × target/mechanism × modality), using CPC codes plus embedding clusters, against a Poisson baseline. Remember that the observable is lagged 18 months.
- **Resolves:** the first ClinicalTrials.gov/ICTRP registration or pipeline disclosure by that assignee in that target within N years. Metrics: precision@k of flagged surges, and lead time (median years from flag to first trial).

### Gaps
- I found no peer-reviewed study quantifying the precision or lead time of filing surges as predictors of trial starts. This is a research opportunity that IP Map could backtest itself.

## Cross-cutting: point-in-time data and scoring metrics

### Takeaway
Patent data is heavily revised after the fact: grants, citations, reassignments, Orange Book delistings, PTAB outcomes. Backtests must use snapshots dated as of the prediction date, or reconstruct history from dated transaction records. Metrics should match the shape of each prediction.

### Cited Findings
- Truncation of patents and citations creates predictable, firm-correlated biases that survive popular adjustments. — [Lerner & Seru, RFS 2022](https://academic.oup.com/rfs/article-abstract/35/6/2667/6324822)
- PatEx and PAIR carry a dated status code for every action, which makes as-of reconstruction of prosecution state possible. — [USPTO PatEx](https://www.uspto.gov/sites/default/files/documents/PatEx%20Working%20Paper.pdf)
- The 2025 PTAB rule change is an example of a regime break that makes pre-2025 base rates stale. — [IPWatchdog](https://ipwatchdog.com/2026/04/08/uspto-stats-show-ipr-institution-rate-plummeted/)
- The M&A prediction literature already uses ranking metrics (Precision@500, mAP, Hit Ratio@5). — [arXiv 2404.07179](https://arxiv.org/html/2404.07179v1)

### Inferences
- As-of rules: (1) compute examiner and art-unit rates only from actions dated before t, (2) use Orange Book snapshots (archived editions) rather than the current file, (3) count only citations dated before t, (4) resolve entity names with the assignment records valid at t, (5) freeze the model version and inputs in the prediction ledger with a hash, and (6) keep a regime flag for PTAB.
- Metric map: binary events (grant, institution, deal in 12 months) → Brier score, log loss, reliability curve, AUC. Dates (generic entry, deal timing) → CRPS or pinball loss and interval coverage. Shortlists (buyers, likely out-licensors, surges) → precision@k, Hit@k, MRR. Value and citations → Spearman correlation and top-decile precision.

### Gaps
- None of the sources found describe point-in-time practice specifically for patent-intelligence vendors. The guidance above is inferred from finance backtesting norms and the cited truncation literature.
