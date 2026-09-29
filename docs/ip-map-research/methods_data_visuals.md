# Patent analytics methods, open data and visual IP maps (for a biotech "IP Map" product)

Research date: 2026-09-28. Scope: citation evidence, claim analysis, open data, visualization, feature ideas. Every claim below carries an inline source; items I could not verify within this pass are listed under Gaps rather than stated as fact.

## 1. Do citation-based metrics predict licensing, acquisition, litigation and patent value?

### Takeaway
Forward citations are a real but noisy correlate of private value, litigation and tradability. The effects are well replicated: renewal, Tobin's q, stock-market value, litigation and university licensing all line up with them. But they explain only part of the variation. Since about 2000 their information content has weakened: a few applications now generate most citations, and citing and cited patents are less technologically similar. So raw counts need to be normalized by cohort and technology, split by citation type (examiner vs applicant), and weighted for relevance. The strongest acquirer and licensee signal is directional, firm-to-firm citation and technological similarity, not how many citations a patent has.

### Cited Findings
- **Renewal/value (Harhoff, Narin, Scherer & Vopel 1999, REStat 81(3):511-515).** They surveyed the value of 964 US and German inventions whose German patents were renewed to full term in 1995. Full-term renewed patents were cited significantly more than patents allowed to lapse, and the higher the value estimate, the more the patent was cited. — [ZEW](https://www.zew.de/en/publications/citation-frequency-and-the-value-of-patented-inventions); [MIT Press](https://direct.mit.edu/rest/article/81/3/511/57132/Citation-Frequency-and-the-Value-of-Patented)
- **Market value (Hall, Jaffe & Trajtenberg 2005, RAND J. Econ 36(1):16-38).** Tobin's q regressions over 1963-1999 show that one extra citation per patent raises firm market value by about 3%. "Unpredictable" citations carry more value than the predictable part, and self-citations are worth more than external citations. — [NBER w7741](https://www.nber.org/papers/w7741); [IDEAS](https://ideas.repec.org/a/rje/randje/v36y20051p16-38.html); [Hall PDF](https://eml.berkeley.edu/~bhhall/papers/HallJaffeTrajtenberg_RJEjan04.pdf)
  - Product implication: self-citation is a value signal (the firm is building on its own position), not noise to strip out.
- **Stock-market patent value (Kogan, Papanikolaou, Seru & Stoffman 2017, QJE 132(2):665).** The market reaction to a patent grant gives a patent-level private value for US firms from 1926 to 2010. It correlates positively with forward citations but carries extra information, and it relates more strongly to firm growth than citation-weighted counts. — [NBER w17769](https://www.nber.org/papers/w17769); [QJE](https://academic.oup.com/qje/article-abstract/132/2/665/3076284)
  - Open data: KPSS values, forward citations, patent→CRSP permno and patent→CPC matches, extended to 2022. — [GitHub KPSS2017](https://github.com/KPSS2017/Technological-Innovation-Resource-Allocation-and-Growth-Extended-Data)
  - Useful as ground truth for training a value model, but only for public-company patents.
- **Examiner vs applicant citations (Hegde & Sampat 2009, Economics Letters 105(3)).** Citations added by examiners predict renewal (private value) better than citations added by applicants. — [SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1807078); [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0165176509002845)
- **Patents used in rejections (Cotropia, J. Empirical Legal Studies 2025).** Citations to a patent that are used in Office-action rejections are studied as a separate value indicator. — [Wiley JELS](https://onlinelibrary.wiley.com/doi/10.1111/jels.12404)
  - I did not extract effect sizes.
  - This points to the Office Action rejection data (Section 3) as a higher-signal citation layer.
- **Citation proliferation (Kuhn, Younge & Marco 2020, RAND J. Econ 51(1):109-132).** A small minority of applications now generates most citations, and the mean technological similarity between citing and cited patents has fallen considerably. Replicating well-known studies shows that generic assumptions about citations have misled the field. Subsetting or weighting citations by text similarity (a vector-space model) substantially improves predictive power. — [SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2714954); [Wiley](https://onlinelibrary.wiley.com/doi/abs/10.1111/1756-2171.12307)
- **Litigation (Lanjouw & Schankerman).** Litigated patents are cited much more often than random patents from the same cohort and technology. Patents that are more valuable, domestically owned, or in new technology areas are more likely to be litigated, and claim count is related to litigation probability. — [NBER w6297 "Stylized Facts of Patent Litigation"](https://www.nber.org/papers/w6297); [SSRN "Enforcing IP Rights"](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=294717)
- **Litigation-based value scoring.** A licensing-practitioner article (LESI) scores patents by how closely they resemble litigated patents. — [LESI](https://lesi.org/article-of-the-month/patent-value-scoring-patents-using-characteristics-of-patents-in-litigation/)
- **Recent ML: claim dependency for litigation prediction.** A 2026 arXiv paper models the claim-dependency tree with graph attention networks. — [arXiv 2608.21924](https://arxiv.org/pdf/2608.21924)
  - Preprint, not peer reviewed.
- **University licensing.** At major US research universities, citations predict whether a technology gets licensed, but not the revenue it earns once licensed. — [Springer chapter, "Patent Citations and the Economic Value of Patents"](https://link.springer.com/chapter/10.1007/1-4020-2755-9_13)
  - This comes from the search snippet. I did not extract the exact effect size or authors from the full text.
- **Licensing as a signpost.** After an exclusive university license, forward citations from private-sector non-licensees increase. — [ScienceDirect, J. Econ. Behavior & Org.](https://www.sciencedirect.com/science/article/abs/pii/S0167268117300847)
- **Biotech-specific citation drivers.** Studied determinants include use of science, breadth of technological base, collaboration, claim count, scope and novelty. Their effect on citations differs across industrial and organizational boundaries. — [Tech. Forecasting & Social Change / arXiv 1403.2096](https://arxiv.org/pdf/1403.2096)
- **Academic vs corporate biotech license economics (PLOS One 2023).**
  - Median royalty 3% academic vs 8% corporate.
  - Median deal size $0.9M vs $31.0M.
  - Median pre-commercial payments $1.1M vs $25.4M.
  - — [PLOS One](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0283887)
- **Acquisition premiums.** Interfirm citation activity between target and acquirer is an important driver of acquisition premiums (screening perspective, Long Range Planning 2025). — [ScienceDirect S0024630125000378](https://www.sciencedirect.com/science/article/abs/pii/S0024630125000378)
  - The full text returned 403, so I have no effect size.
- **Predicting patent transactions.** Studies use assignment records as the target variable. Trade probability depends on patent age, citation count, generality and prior trade history. — [IEEE, "Predicting Patent Transactions Using Patent-Based…"](https://ieeexplore.ieee.org/abstract/document/9223646/)
- **M&A forecasting from patent portfolios (Albora, Straccamore & Zaccaria, arXiv 2404.07179).** This uses Zephyr and Crunchbase deals. The interpretable similarity algorithm (MASS) beats a LightGCN graph network in most settings. LightGCN wins when similar firms have disjoint patent activity. — [arXiv](https://arxiv.org/pdf/2404.07179)
- **Early data-mining work on patent-based M&A prediction.** — [Springer LNCS](https://link.springer.com/chapter/10.1007/978-3-642-01256-3_16)
- **Post-transfer citation drop.** Forward citations fall significantly after patents are acquired by patent assertion entities. — [Industry & Innovation 31(4)](https://www.tandfonline.com/doi/abs/10.1080/13662716.2023.2213170)
- **Forecasting future citations as a valuation input.** — [Train et al., Berkeley](https://eml.berkeley.edu/~train/papers/patents.pdf)

### Inferences
- The acquirer/licensee engine should be built on **directed firm-to-firm citation flows**:
  - who cites the target's patents;
  - examiner-added citations weighted higher;
  - citations weighted by text similarity, per Kuhn-Younge-Marco;
  - portfolio similarity, per MASS.
  - Raw forward-citation counts should not be the core of it.
- "Competitive Impact"-style normalization is what the literature implies: citations relative to cohort (grant year) and CPC-group expected citations, which is the Hall-Jaffe-Trajtenberg fixed-effects approach. It is needed because of truncation and field differences.
- Citations predict *whether* a patent is licensed or valued, but weakly predict *how much*. The product should present them as a propensity signal, not a valuation.

### Gaps
- No verified effect sizes for:
  - the 2025 acquisition-premium paper;
  - the IEEE transaction-prediction paper;
  - biotech-specific acquisition prediction.
- The often-quoted Hall-Jaffe-Trajtenberg finding that patents with 20+ citations carry a large value premium is not verified in this pass.
- I found no peer-reviewed study that tests citations for predicting *pharma in-licensing counterparties* specifically. This looks like a real white space the product would have to validate on its own, for example by backtesting against Solidus deal data.
- Family size as a value predictor (Harhoff, Scherer & Vopel 2003; Lanjouw & Schankerman 2004 composite "quality" index) is widely cited but was not fetched here.
- Alcacer & Gittelman's examiner-citation share is also widely cited but was not fetched here.

## 2. Claim-analysis methods

### Takeaway
Two validated, cheap scope proxies are:
1. **Word count of the shortest (first) independent claim.** Shorter means broader.
2. **Independent-claim count.**

Both are computable before and after examination, and USPTO publishes them at scale. Kuhn & Thompson show that the traditional proxies are uninformative or misleading: number of classes, forward citations and number of claims.

Indefiniteness follows the *Nautilus* "reasonable certainty" test. Terms of degree ("about", "substantially") are not automatically indefinite. They fail when the specification gives no objective standard. Purely subjective or evaluative terms ("unobtrusive", "optimal", "best") are the most exposed.

### Cited Findings
- **Kuhn & Thompson (2019, Int'l J. Econ. of Business 26(1):5-38).**
  - Their measure is grounded in patent law and attorney practice: the word count of the independent claim.
  - Validation shows previous scope measures are uninformative or misleading: number of patent classes, forward citations and number of claims.
  - Instrument: an examiner "scope toughness" instrumental variable, based on words the examiner adds to the first claim relative to the art-unit average.
  - An exogenous reduction in scope makes patents much less likely to be declared standard-essential.
  - — [SSRN 2977273](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2977273); [T&F](https://www.tandfonline.com/doi/abs/10.1080/13571516.2018.1553284); [MIT FutureTech](https://futuretech.mit.edu/publication/how-to-measure-draw-causal-inferences-patent-scope)
- **Marco, Sarnoff & deGrazia (2019, Research Policy 48(9)), "Patent claims and patent scope."**
  - Develops and validates independent-claim length and independent-claim count.
  - Both are computable pre- and post-examination.
  - Enables the first large-scale analysis of how scope changes during examination.
  - — [IDEAS](https://ideas.repec.org/a/eee/respol/v48y2019i926.html); [SSRN](https://doi.org/10.2139/ssrn.2844964)
- **USPTO Patent Claims Research Dataset.**
  - Claim-level and document-level data for granted patents and published applications, including dependency and word counts.
  - Distributed via the USPTO Open Data Portal.
  - Users must cite Marco, Sarnoff & deGrazia.
  - — [USPTO PCRD](https://www.uspto.gov/ip-policy/economic-research/research-datasets/patent-claims-research-dataset)
- **Nautilus v. Biosig, 572 U.S. 898 (2014).**
  - Test: a claim is indefinite if, read in light of the specification and prosecution history, it fails to inform a skilled artisan about the invention's scope "with reasonable certainty."
  - This replaced the Federal Circuit's "insolubly ambiguous / amenable to construction" test.
  - — [Ropes & Gray](https://www.ropesgray.com/en/insights/alerts/2014/06/supreme-court-decides-nautilus-v-biosig); [Finnegan](https://www.finnegan.com/en/insights/ip-updates/the-supreme-court-s-nautilus-decision-defines-the-test-for.html)
- **Interval Licensing v. AOL (Fed. Cir. 2014).**
  - Terms of degree are not inherently indefinite.
  - "Unobtrusive manner" was held indefinite as highly subjective, with no intrinsic standard.
  - Terms of degree survive when the intrinsic record supplies a standard for measuring boundaries.
  - — [Finnegan, post-Nautilus terms of degree](https://www.finnegan.com/en/insights/articles/post-nautilus-look-at-terms-of-degree-and-measuring-terms.html); [Nat'l Law Review](https://natlawreview.com/article/terms-degree-not-always-indefinite); [Buchanan](https://www.bipc.com/navigating-terms-of-degree-post-nautilus)
- **Akamai v. MediaPointe (Fed. Cir., Nov. 25, 2025).**
  - "Optimal" and "best" routing were held indefinite because the specification lacked "objective and exclusive boundaries."
  - Practitioner guidance: use quantitative thresholds, formulas, and a rule for resolving trade-offs between competing factors.
  - — [Morgan Lewis](https://www.morganlewis.com/pubs/2025/12/federal-circuit-reinforces-indefiniteness-standard-for-terms-of-degree)
- **Measuring-method indefiniteness.** A separate risk arises when a claimed parameter can be measured by several methods that give different results. This is highly relevant to pharma formulation and PK claims. — [Finnegan](https://www.finnegan.com/en/insights/articles/post-nautilus-look-at-terms-of-degree-and-measuring-terms.html)

### Inferences
- A claim-strength score for biotech could combine:
  1. first independent-claim word count, normalized by CPC group and year (breadth);
  2. independent-claim count and dependency depth (fallback positions);
  3. an indefiniteness lexicon flag, tiered:
     - high risk for subjective or evaluative terms (optimal, best, unobtrusive);
     - medium risk for degree terms (about, substantially, approximately) that have no numeric anchor in the specification;
     - lower risk when the spec defines them;
  4. parameters in the claim whose measurement method is unspecified;
  5. scope narrowing during prosecution, from comparing the published application claims with the granted claims in PCRD. Heavy narrowing signals examiner toughness and estoppel.
- Because Kuhn & Thompson find that forward citations and claim counts are poor scope proxies, the product should show "breadth" and "importance" as separate axes rather than blending them.

### Gaps
- Biotech-specific claim risks were not researched in this pass:
  - genus and Markush breadth under *Amgen v. Sanofi* (2023) enablement;
  - written description.
  - For antibody and small-molecule genus claims these are arguably more important than indefiniteness. A dedicated legal-sources pass is recommended.
- I found no quantified validity-outcome rate for claims containing "about" or "substantially".

## 3. Free and open patent data sources (fields, licences, limits)

### Takeaway
A credible US-first stack can be built for $0 in data cost:
- PatentsView tables, now on the USPTO Open Data Portal: citations with applicant/examiner category, disambiguated assignees and inventors, CPC, claims;
- the USPTO research datasets: claims (PCRD), assignments (UPAD), Office Action rejections, and PTAB;
- Google Patents Public Datasets on BigQuery for global families and citations;
- EPO OPS for INPADOC families and legal status;
- the Marx-Fuegi Reliance on Science dataset for patent-to-paper links via OpenAlex IDs.

The main traps are licensing:
- Lens API commercial use requires a paid plan;
- Reliance on Science is CC BY-NC;
- the PatentsView API was retired in March 2026.

### Cited Findings
- **PatentsView → USPTO ODP migration.**
  - The legacy site began migrating to data.uspto.gov on March 20, 2026.
  - The PatentSearch API (search.patentsview.org) was shut down on March 20, 2026, and its data moved to ODP bulk datasets.
  - Old API keys do not work, so new ODP keys are needed.
  - Limit: 20 downloads of the same file per API key per year (HTTP 429 on the 21st).
  - Some functions are to be reintroduced later, with no date.
  - — [USPTO notice](https://www.uspto.gov/subscription-center/2026/patentsview-migrating-uspto-open-data-portal-march-20); [ODP transition guide](https://data.uspto.gov/support/transition-guide/patentsview)
- **PatentsView citation table.**
  - Citation category values: "cited by applicant", "cited by examiner", "cited by other", "cited by third party", NULL.
  - The applicant/examiner split enables Hegde-Sampat-style weighting.
  - The publication table runs to Dec 25, 2025.
  - — [PatentsView forum](https://patentsview.org/forum/7/topic/123); [US Application Citation endpoint](https://patentsview.org/apis/api-endpoints/usapplicationcitationbeta)
- **Examiner citations come from Form PTO-892**, which lists references relied on in a rejection or noted as pertinent. — [PatentsView forum](https://patentsview.org/forum/7/topic/123)
- **Patent citations as empirical measures (Kuhn, Younge & Marco 2017 working paper)**, covering data caveats of citation categories. — [BU TPRI PDF](https://sites.bu.edu/tpri/files/2017/07/Patent-Citaitons-and-Empirical-Analysis-Kuhn-Young-Marco-July-2017.pdf)
- **USPTO Patent Assignment Dataset (UPAD).**
  - About 6M assignments, licenses, security interests and other conveyances.
  - Covers about 10M US patents and applications, recorded 1970-2014 in the original release.
  - Fields include:
    - patent and application numbers;
    - execution and recordation dates;
    - assignor(s) and assignee(s);
    - "nature of conveyance" (assignment, merger, security agreement, license).
  - — [Marco et al. SSRN](https://doi.org/10.2139/ssrn.2849634); [Graham, Marco & Myers JEMS 2018](https://onlinelibrary.wiley.com/doi/abs/10.1111/jems.12262); [USPTO page](https://www-aws-zone-1.uspto.gov/ip-policy/economic-research/research-datasets/patent-assignment-dataset)
- **Office Action data.**
  - The Office Action Research Dataset offers full-text Office actions and rejection-level data.
  - There is an Office Action Rejection API (beta).
  - The Office Action Text Retrieval API is being migrated to ODP.
  - — [USPTO Rejection API](https://developer.uspto.gov/api-catalog/uspto-office-action-rejection-api-beta); [Text Retrieval API](https://developer.uspto.gov/api-catalog/uspto-office-action-text-retrieval-api-will-be-migrated-odp)
- **PTAB API.**
  - A RESTful search and bulk download of PTAB public documents (proceedings, decisions).
  - v1 and v2 are listed.
  - — [PTAB API v1](https://developer.uspto.gov/api-catalog/ptab-api-v1); [data.gov PTAB API v2](https://catalog.data.gov/dataset/patent-trial-and-appeal-board-ptab-api-version-2-0)
- **USPTO Open Data Portal** is a free single point of access for these datasets. — [ODP](https://data.uspto.gov/home); [ODP FAQ](https://data.uspto.gov/support)
- **Google Patents Public Datasets (BigQuery).**
  - `patents.publications` holds worldwide bibliographic data, with full text for US only.
  - Fields include `family_id` and the citation array.
  - A `patentsview.claim` table is a cheaper path to claims.
  - Dates are INTEGER YYYYMMDD.
  - Schema docs live on GitHub.
  - — [Google Cloud blog](https://cloud.google.com/blog/topics/public-datasets/google-patents-public-datasets-connecting-public-paid-and-private-patent-data); [schema docs](https://github.com/google/patents-public-data/blob/master/tables/dataset_Google%20Patents%20Public%20Datasets.md); [AIPLA](https://www.aipla.org/list/innovate-articles/programmatic-patent-searches-using-google-s-bigquery-public-patent-data)
- **EPO OPS.**
  - Free "non-paying" access is capped at 4 GB/week, with OAuth2 consumer key and secret.
  - Covers CQL search, INPADOC family (biblio and legal), legal status, EP Register and images.
  - — [patent-dev/epo-ops](https://github.com/patent-dev/epo-ops); [PatZilla OPS setup](https://docs.ip-tools.org/patzilla/configure/epo-ops.html)
- **EPO bulk data.** From Jan 1, 2025, several previously paid bulk products became free via the Bulk Data Download Service. — [patent.dev](https://patent.dev/game-changer-key-epo-patent-datasets-are-now-free/)
  - Secondary source; confirm the product list on epo.org.
- **Lens.**
  - API access requires an institutional subscription.
  - Trial access is non-commercial or limited academic only.
  - Commercial use needs a custom plan.
  - — [Lens API terms](https://about.lens.org/lens-api-terms-of-use/); [Lens APIs](https://about.lens.org/lens-apis/)
- **Lens content.** Over 200M scholarly records, with patent↔scholarly cross-citations (PatCite). — [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC13157963/); [PatCite](https://about.lens.org/patcite-linking-patents-and-scholarship/)
- **Reliance on Science (Marx & Fuegi).**
  - Covers worldwide front-page and in-text patent-to-paper citations through 2022, plus patent-paper pairs through 2021.
  - Pairs are patents with a paper co-authored by an inventor within ±9 years.
  - Keyed by patent publication number and OpenAlex work ID.
  - License is CC BY-NC; contact the authors for commercial use.
  - — [Zenodo](https://zenodo.org/records/8169036); [SMJ 2020](https://sms.onlinelibrary.wiley.com/doi/full/10.1002/smj.3145); [JEMS 2022](https://onlinelibrary.wiley.com/doi/abs/10.1111/jems.12455)
- **KPSS patent values** (public firms, through 2022) are on GitHub. — [GitHub](https://github.com/KPSS2017/Technological-Innovation-Resource-Allocation-and-Growth-Extended-Data)

### Inferences
- The **Reliance on Science NC licence** and the **Lens commercial restriction** matter for a paid product. Options:
  - negotiate a license;
  - rebuild patent-to-paper links yourself from front-page non-patent-literature citations in PatentsView or Google data, matched to OpenAlex (CC0).
- UPAD's "nature of conveyance" plus merger records is the direct open source for **M&A and licensing reassignment signals**. Security agreements flag distressed or collateralized portfolios.
- The 20-downloads-per-file-per-year ODP cap means ingestion should mirror the data once into your own warehouse rather than re-pull it.

### Gaps
- I did not verify:
  - current ODP field lists;
  - whether PatentsView disambiguation (assignee/inventor IDs) continues to be updated post-migration (the transition page did not render);
  - the current UPAD coverage end date;
  - the status of PEDS vs Patent Center file-wrapper APIs in 2026.
- The existence and licensing of Google's `embedding_v1` field were not confirmed.
- I did not check whether OpenAlex itself now carries patent records.

## 4. State-of-the-art visual IP maps

### Takeaway
The open-source standard is still:
- force-directed citation and co-assignee networks (Gephi ForceAtlas2, VOSviewer);
- CPC/IPC overlay maps;
- more recently, text-embedding "landscapes" (transformer embeddings → UMAP → clusters).

Maps are actionable when node position means something:
- semantic or CPC proximity;
- edges carry direction and type (examiner/applicant, citing firm);
- clicks lead to a decision object (acquirer list, FTO flag).

They are decorative when they are all-patent hairballs.

### Cited Findings
- **WIPO Manual on Open Source Patent Analytics.**
  - Recommends Gephi for patent networks.
  - The WIPO Animal Genetic Resources landscape text-mined 11M full-text patents and visualized them in Gephi.
  - — [WIPO manual: Gephi](https://wipo-analytics.github.io/manual/gephi-1.html); [Tools overview](https://wipo-analytics.github.io/manual/an-overview-of-tools.html)
- **ForceAtlas2**, Gephi's default continuous force-directed layout, is designed for networks of about 10-10,000 nodes. — [PLoS ONE / PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4051631/)
- **Gephi and VOSviewer.** Gephi handles interactive maps of up to about 100k nodes. VOSviewer specializes in citation, co-authorship and text-mining maps. — [Patently tools roundup](https://patently.com/industry-news/patent-citation-network-visualization-tools)
  - Vendor blog; treat as indicative.
- **Interactive overlay maps.** USPTO patents are positioned on a base map of IPC classes, so a portfolio shows as an overlay on the full technology space (Leydesdorff et al.). — [arXiv 1210.6456](https://arxiv.org/pdf/1210.6456)
- **Deep patent landscaping** with transformers plus graph embeddings. — [arXiv 1903.05823](https://arxiv.org/pdf/1903.05823)
- **Benchmark of 22 patent embedding models** for retrieval, classification and clustering, visualized with UMAP. — [arXiv 2605.24297](https://arxiv.org/pdf/2605.24297)
- **UMAP** is non-linear dimensionality reduction suited to 2D and 3D cluster maps. — [lmcinnes/umap](https://github.com/lmcinnes/umap)
- **The Lens "Explore Citations"** navigates the citing and cited graph across patents and scholarly works. — [Lens support](https://support.lens.org/knowledge-base/exploring-citations/)
- **Patent network analysis** methods overview. — [Springer](https://link.springer.com/chapter/10.1007/978-981-16-2930-3_8)

### Inferences
Recommended core views for a visual-first biotech product:

1. **Ego network** around the client's asset or portfolio: directed forward-citation edges aggregated to *firms*, not patents. Node size is citation weight, and edge color separates examiner from applicant citations. This directly answers "who is building on us?"
2. **Semantic landscape**: claim or abstract embeddings, then UMAP, then HDBSCAN clusters, with contour density. The client's patents are highlighted, competitor portfolios are overlaid, and low-density regions are marked as white space.
3. **Sankey of citation flows** between companies over time windows.
4. **Ownership timeline**: UPAD conveyances as swimlanes (assignment, merger, license, security interest).
5. **Thicket or density heatmap** by target/indication × CPC.
6. **Claim-strength small multiples**: breadth, fallback depth and indefiniteness flags per family.

What makes these actionable:
- a ranked, exportable list next to every map;
- explanations of why each node is ranked;
- time sliders;
- filters by citation type.

### Gaps
- I did not find peer-reviewed user studies comparing the decision usefulness of IP visualization types.
- Commercial examples (PatSnap, Derwent, Cipher, LexisNexis PatentSight Asset Index/Competitive Impact) were not fetched in this pass.
- PatentSight's Competitive Impact and Technology Relevance definitions need sourcing from their methodology papers.

## 5. Feature ideas beyond citation frequency and claim analysis

### Takeaway
The most defensible, evidence-backed differentiators are these. Each maps to an open dataset.
- Directional firm-to-firm citation and similarity for acquirer and licensee propensity, using text-weighted citations and portfolio similarity.
- Reassignment and conveyance signals from UPAD.
- Prosecution-history scope narrowing from PCRD and Office Actions.
- PTAB and litigation-likeness risk.
- Thicket density from citation triples.
- Science linkage from patent-to-paper data.

### Cited Findings
- **Patent thicket density (von Graevenitz, Wagner & Harhoff 2011, Economics Letters 111(1):6-9).** They count "triples" of mutually blocking patents held by three firms, using EPO search-report X/Y references, and identify thicket-affected technology areas. — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0165176510004374); [CORE PDF](https://files01.core.ac.uk/download/pdf/12171664.pdf)
- **Thickets and first-time patenting.** — [VoxEU/CEPR](https://voxeu.org/article/patent-thickets-and-first-time-patenting-new-evidence)
- **Acquirer-target interfirm citations drive acquisition premiums.** — [LRP 2025](https://www.sciencedirect.com/science/article/abs/pii/S0024630125000378)
- **Patent-portfolio similarity forecasts M&A pairs (MASS).** — [arXiv 2404.07179](https://arxiv.org/pdf/2404.07179)
- **Trade probability** rises with citations and generality and depends on prior trade history, so prior reassignment predicts future reassignment. — [IEEE 9223646](https://ieeexplore.ieee.org/abstract/document/9223646/)
- **UPAD's nature of conveyance** (merger, license, security) is a direct transaction signal. — [JEMS 2018](https://onlinelibrary.wiley.com/doi/abs/10.1111/jems.12262)
- **Litigation-likeness.** Litigated patents are more cited, more valuable, domestic, in new areas and have more claims. — [NBER w6297](https://www.nber.org/papers/w6297)
- **SEP-likelihood falls with narrower scope**, which argues for using scope as an input to licensing propensity. — [Kuhn & Thompson](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2977273)
- **Science linkage.** Patent-to-paper citations and patent-paper pairs link inventors to publications. — [Reliance on Science](https://zenodo.org/records/8169036)
- **Examiner citations that are used in rejections** are a higher-signal citation layer. — [Cotropia 2025](https://onlinelibrary.wiley.com/doi/10.1111/jels.12404)
- **Knowledge flow from science to technology via deep learning.** — [arXiv 2512.24259](https://arxiv.org/pdf/2512.24259)

### Inferences
Feature list, roughly in order of evidence strength:

1. **Licensee/acquirer propensity score.** Per candidate firm, combine:
   - volume of directed citations to the asset, examiner-weighted and similarity-weighted;
   - portfolio embedding similarity;
   - the firm's past in-licensing and acquisition conveyances (UPAD);
   - therapeutic-area deal history (Solidus).
   - Backtest it on known deals.
2. **Blocking-citation alerts.** Flag when a competitor's application is rejected over the client's patent (Office Action rejections citing it). That is direct evidence of dependence and a licensing lever.
3. **Reassignment and M&A radar.** New merger or assignment conveyances on competitor families, security interests as a distress flag, and assignee-name changes.
4. **Prosecution narrowing index.** Compare application and grant claim word counts from PCRD, plus examiner toughness.
5. **Indefiniteness and measurement-method flags**, following Section 2.
6. **Thicket density** per target or indication, using citation triples adapted to US/EP X-category citations.
7. **Family and continuation strategy tracker.** Open continuations keep claims flexible and are a signal of strategic importance. INPADOC family breadth comes from EPO OPS.
8. **PTAB and litigation risk.** Use the PTAB API history on the family and on similar claims, plus a litigation-likeness model.
9. **Inventor mobility.** Track disambiguated inventor IDs across assignees, from PatentsView.
10. **Science linkage.** Connect patent families to the underlying papers and labs (OpenAlex) to spot academic assets likely to be licensed.
11. **AI claim charting.** Use an LLM to map claim elements against a competitor product label or pipeline description. This is a triage aid, not an FTO opinion.

### Gaps
- None of the propensity combinations above are validated in the literature for biotech. They need an internal backtest.
- I did not source:
  - continuation-count value evidence;
  - inventor-mobility-to-acquisition evidence;
  - LLM claim-charting accuracy benchmarks.
- US-only open data under-covers China, Japan and Korea biotech. EPO OPS/DOCDB help on bibliographic data but not full-text claims.
