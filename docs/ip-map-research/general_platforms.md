# General-Purpose Patent Analytics & IP Intelligence Platforms (competitor scan for a biotech "IP Map")

Research date: 2026-09-28. About 20 tool calls. Some vendor help centres (PatentSight/LexisNexis support, PatSnap help) returned HTTP 403, so a few details below come from search snippets of those pages and not from full-page reads. Where that happened, it is flagged. Pricing from third-party "comparison" blogs (beyondelevation.com, patentailab.com, softwarefinder.com) is low-reliability SEO content. Treat it as a rough indication only.

Ownership and rebrand map (current state):
- LexisNexis IP (RELX) owns PatentSight (now "PatentSight+"). It also owns Cipher (Aistemos, definitive agreement to acquire announced Feb 2023) and IPlytics (acquired Nov 9 2022). Cipher's classifiers are now built into PatentSight+ — [LexisNexis Cipher deal](https://www.lexisnexisip.com/resources/lexisnexis-enters-into-definitive-agreement-to-acquire-aistemos-and-its-cipher-classification-platform/); [IPlytics deal](https://www.lexisnexisip.com/resources/lexisnexis-expands-its-intellectual-property-solutions-suite-with-the-acquisition-of-iplytics/); [PatentSight+ combining datasets](https://www.lexisnexisip.com/resources/lexisnexis-combines-best-in-class-patent-datasets-and-software-solutions-boosting-innovation-analytics-to-a-new-level/)
- Clarivate (after it acquired CPA Global in 2020) has renamed its products. Innography is now "Derwent Patent Analytics" and Derwent Innovation is now "Derwent Patent Search" — [Clarivate: Derwent Patent Analytics, formerly Innography](https://clarivate.com/intellectual-property/derwent/patent-analytics/)
- AcclaimIP is owned by Anaqua. acclaimip.com pages now redirect (301) to anaqua.com — [Anaqua](https://www.anaqua.com/resources/patent-scores-and-how-to-use-them-acclaimip/)
- See-the-Forest is the free/entry front end of IPVision Inc. ("IPVision Advantage"), which is based on MIT-derived patented technology — [IPVision](https://info.ipvisioninc.com/patent-analytics-see-the-forest)

---

## Q1. Which platforms explicitly market licensee/acquirer ("who is building on my IP") identification from citations, and how?

### Takeaway
Only two vendors in this set explicitly market a licensee-finding product. PatSnap launched "Licensee Locator" in Dec 2017; it is similarity- and deal-history-based, and its current status is unclear. Ambercite offers a "Licensing Potential / Licensing Deal Potential Index" built on citation-network similarity. The other platforms leave you to rank citing assignees by hand from a forward-citation list or map (Orbit, PatSnap citation map, Derwent, Patent iNSIGHT Pro, See-the-Forest). None of them publishes a validated method that turns citations into a licensee or acquirer probability normalized for filer size. The closest prior art is an old CHI Research patent (US7433884B2) on multi-generation citation-weighted licensee ranking.

### Cited Findings
- **PatSnap Licensee Locator** (announced 6 Dec 2017). Input is a patent number, a text snippet or a patent collection. The tool "identif[ies] and rank[s] a shortlist of potential licensees", shows financial and IP information for each company, and "gauge[s] companies' likelihood to license, based on previous deals." The article does not name the data sources — [Research Live, Dec 2017](https://www.research-live.com/article/news/patsnap-launches-automated-tool-for-rd-licensing/id/5031572)
- PatSnap's help centre describes a citation map for seeing "who is citing your work to identify potential infringement, competitors and licensing opportunities." Its help pages also have a "Types of Citation" article, but that page returned 403 so the specific citation types could not be verified — [PatSnap Citation Analysis help](https://help.patsnap.com/hc/en-us/articles/115002351685-Citation-Analysis); [Types of Citation (403)](https://help.patsnap.com/hc/en-us/articles/12479407137949-Types-of-Citation)
- PatSnap's current public pricing page lists Eureka (AI agents), Analytics, Bio, Chemical, Synapse (biopharma intel) and an Open Platform/API. **None of them is listed as a "Licensee Locator" module**, so the 2017 feature may have been folded into other products or dropped (inference) — [PatSnap pricing](https://www.patsnap.com/pricing)
- **Ambercite** uses "AI-assisted citation-based search". It finds companies through backward citations and through forward citations ("those already citing similar innovations"). It applies a "Licensing Deal Potential Index" to each result, which users can aggregate by company to rank owners. It also surfaces "hidden links" / "unknown citations", meaning companies connected through indirect network paths. A user can select up to 2,000 results. Free trial available; pricing not disclosed — [Ambercite blog, Aug 2024](https://www.ambercite.com/amberblog/2024/8/29/ambercite-your-treasure-map-to-quickly-find-companies-for-licensing-your-technology-in-a-180-billion-market)
- Ambercite claims a database of more than 106M patents and 175M citations, and uses deep-learning plus network algorithms to rank "most similar and most important" patents (vendor claim) — [Ambercite AI](https://www.ambercite.com/ambercite-ai); [Ambercite home](https://www.ambercite.com/)
- LESI article (Mike Lloyd, May 2015) sets out four approaches for finding licensees from forward citations: (1) scan the owner lists of forward citations; (2) count citations by applicant; (3) Patent River's "Forward Rejection" analysis of examiner-identified similarity; (4) AmberScope network analysis with a similarity filter plus an importance filter (AmberScore, scaled so the average US patent = 1.0; above 2.0 is worth investigating). The article's validation is anecdotal: two litigated examples, the Paice hybrid patent US5343970 and the CMU patents behind the $1.13B Marvell verdict. Its key caveat is that "not all forward citation patents are the same — in both commercial value and the similarity." Note: Lloyd is associated with Ambercite, so this is not independent — [LESI](https://lesi.org/article-of-the-month/advanced-citation-analysis-can-help-identify-licensing-candidates/)
- **Prior art on the method itself**: US7433884B2, assigned to CHI Research Inc (priority 29 Sep 2004), "Identification of licensing targets using citation neighbor search process." It ranks potential licensees by "strength values" from citation linkages. Direct forward citations get weight 1.0, second generation 0.5, third generation 0.333, and the values are summed across paths. Neighbor relations are precomputed for real-time queries — [Google Patents US7433884B2](https://patents.google.com/patent/US7433884B2/en)
- **Questel Orbit Intelligence** citation search can show analysed FamPat families, cited/citing families "or top assignees". Users can switch between patent-level and family-level citation environments, which Questel claims is unique. Licensing appears as a use case, and users can set watches on citations — [Questel citation search](https://www.questel.com/communication/citations-search-en.html); [Orbit product page](https://www.questel.com/patent/ip-intelligence-software/orbit-intelligence/)
- **Patent iNSIGHT Pro** offers an Assignee-Assignee and Inventor-Inventor co-citation matrix, self-citation analysis and a multi-generation citation tree visualiser (search-snippet description of the vendor site) — [Patent iNSIGHT Pro](https://www.patentinsightpro.com/)
- **IPlytics** (LexisNexis) is aimed at SEP licensing. It covers SEP declarations, standards contributions, "Ultimate Owner" roll-ups and AI-predicted claim essentiality. It is not citation-based licensee finding — [LexisNexis IPlytics](https://www.lexisnexisip.com/solutions/ip-analytics-and-intelligence/iplytics/); [Ultimate Owner concept](https://www.lexisnexisip.com/resources/empowering-sep-analysts-with-insights-using-the-ultimate-owner-concept/)
- **Cipher** (LexisNexis) uses supervised ML classifiers to map patents to custom or industry taxonomies. It is a landscape and classification tool, not a licensee finder — [Cipher platform](https://www.lexisnexisip.com/solutions/ip-analytics-and-intelligence/cipher-classification/cipher-platform/)

### Inferences
- The market gap is real. Incumbents give you either (a) raw citing-assignee lists or maps, or (b) opaque "licensing potential" indices (Ambercite, PatSnap 2017) with no published validation. A biotech IP Map could differentiate by ranking licensees with transparent normalization (examiner vs applicant, filer volume, CPC, age) and backtesting against actual deal outcomes. No competitor in this set publishes that.
- PatSnap's Synapse (biopharma intelligence) plus its Analytics citation data is the most plausible incumbent threat for a biotech licensee finder. However, no current PatSnap page found here explicitly markets citation-driven licensee ranking.

### Gaps
- PatSnap Licensee Locator: current (2026) status, algorithm and data sources could not be verified.
- How Ambercite's Licensing Potential index is computed, and any validation of it, is not published.
- No independent (non-vendor) study was found that validates any vendor's licensee-prediction feature.

---

## Q2. Which distinguish examiner vs applicant citations, and which normalize citation counts (age, CPC/tech field, filer volume, office)?

### Takeaway
Examiner/applicant separation is available as data in Derwent (DPCI origin codes), Google Patents (examiner / third-party markers) and AcclaimIP (used inside its C-Score). Normalization for age, office practice and tech field is standard in PatentSight's Technology Relevance and Orbit's Technology Impact (both scaled so the average = 1) and in AcclaimIP (age-weighted, then percentile). **No platform found normalizes by the citing filer's patenting volume**, which is the key normalization for "is this assignee disproportionately building on my IP?"

### Cited Findings
- **Derwent Patents Citation Index (DPCI)**: more than 98M patent and 11M literature citations across more than 11M families. Citation origin can be searched in field /ORC with the codes A/E/O/T/U = APPLICANT / EXAMINER / OPPOSITION / THIRDPARTY / UNKNOWN. Search-report relevance categories are also captured — [CAS STNext DPCI manual](https://cas-stnext.zendesk.com/hc/en-us/articles/29952385357453-Derwent-Patents-Citation-Reference-Manual); [Clarivate DPCI](https://clarivate.com/intellectual-property/derwent/patents-citation-index/); [Web of Science: Articles Cited by Examiner](https://webofscience.zendesk.com/hc/en-us/articles/20139702144785-Derwent-Articles-Cited-by-Examiner)
- **Google Patents** citation tables carry the legend "* Cited by examiner, † Cited by third party" (verified on the US7433884B2 page). Google Patents also has "Cited by" forward-citation lists that include family-to-family citations — [Google Patents US7433884B2](https://patents.google.com/patent/US7433884B2/en); [IPO Google Patents guide](https://ipo.org/wp-content/uploads/2019/11/2019-10-Patent-Searching-Google-Patents.pdf)
- **AcclaimIP C-Score** (citation score) factors in "citations from highly-cited patents; examiner vs. applicant citations; co-pending citations; forward 102 (novelty) and 103 (obviousness) citations; age-weighted citation rates; family citations." It is measured "relative to expected rates given patent age" — [Anaqua / AcclaimIP patent scores](https://www.anaqua.com/resources/patent-scores-and-how-to-use-them-acclaimip/)
- AcclaimIP also has an "Uncited Prior Art Score" — [AcclaimIP help](https://help.acclaimip.com/m/acclaimip_help/l/1676308-uncited-prior-art-score)
- **PatentSight Technology Relevance** is based on worldwide citations received from other patent families. It is adjusted because "(1) older patents are cited more often... (2) international patent offices follow different citation rules; and (3) different citation practices are prevalent in different technology fields." The average value is 1.0 (verified from the text of the vendor PDF) — [LexisNexis PAI whitepaper PDF](https://www.lexisnexisip.com/wp-content/uploads/2024/06/The-Patent-Asset-Index.pdf); [PAI methodology support page](https://ps-support.lexisnexisip.com/hc/en-us/articles/30726663125651-The-Patent-Asset-Index-Methodology)
- **Orbit Technology Impact**: "forward citations received by the analyzed patent families, corrected to account for age and technical domains," with the average normalized to 1. The documentation does not say whether examiner and applicant citations are separated. Orbit also offers citation velocity (forward citations ÷ years since first publication) — [Orbit value metrics](https://intelligence.help.questel.com/en/support/solutions/articles/77000473131-patent-metrics-value-metrics); [Orbit citation metrics](https://intelligence.help.questel.com/en/support/solutions/articles/77000435237-patent-metrics-citations)
- Family-to-family citation counting is used in LexisNexis tools: citations are counted once between families, not per member document — [LexisNexis family-to-family citation](https://support.lexisnexisip.com/hc/en-us/articles/20133304698259-What-is-Family-to-Family-Citation)
- Ambercite's AmberScore is network-importance based and scaled so the average US patent = 1.0 — [LESI](https://lesi.org/article-of-the-month/advanced-citation-analysis-can-help-identify-licensing-candidates/)

### Inferences
- Filer-size normalization is missing everywhere. Without it, raw citing-assignee rankings are dominated by large filers (in biotech: Roche, Novartis and so on cite heavily simply because they file heavily). A lift-style metric would be new relative to this set: citing share ÷ the assignee's share of all filings in the CPC.
- Whether PatentSight excludes self-citations or weights examiner citations could not be confirmed, because its support pages returned 403.

### Gaps
- PatentSight: treatment of self-citations and examiner vs applicant citations is not verified.
- PatSnap: whether its "Types of Citation" include examiner vs applicant is not verified (403).
- Lens.org examiner/applicant flags: not checked in this pass.

---

## Q3. Which offer claim-level analytics (breadth, word count, element count, indefinite terms)?

### Takeaway
Claim analytics in this set are thin. AcclaimIP folds independent-claim length and claim count into its L-Score. Innography PatentStrength uses claim-related variables among 30+ predictors, but they are not itemized. **No platform found scores indefinite terms such as "about" or "substantially", or counts claim elements.** This is an open lane.

### Cited Findings
- AcclaimIP L-Score (legal score) inputs: "pendency duration; independent claim length; total claim count; office action frequency; family size; remaining patent life." The page gives no formula for word counts or breadth — [Anaqua / AcclaimIP](https://www.anaqua.com/resources/patent-scores-and-how-to-use-them-acclaimip/)
- Innography PatentStrength: 0–100, "combines over 30 predictive variables," derived from the likelihood that a patent will be litigated — [Innography PatentStrength](https://www.innography.com/why-innography/patentstrength); [Clarivate Innography](https://clarivate.com/products/ip-intelligence/patent-intelligence-software/innography/)
- The search surfaced a family of USPTO patents on automated claim-breadth scoring, e.g. "claim breadth score = sqrt(word-count score² + commonness score²)": US10657368, US10755045, US11393237, US10366461, US11263714, US11734782. **These were not confirmed as AcclaimIP IP.** The assignee was not verified; they may belong to another vendor (such as Aon/IP analytics), so do not attribute them to AcclaimIP without checking — [US10657368](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10657368); [US11734782](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11734782)

### Inferences
- A biotech-specific claim module is not offered by any general platform in this set. It would cover Markush/genus breadth, sequence-identity % thresholds, and indefinite terms flagged against Nautilus v. Biosig and Amgen v. Sanofi enablement risk.

### Gaps
- Relecura, PatSnap, Derwent and PatentSight+ "Patent Strength" were not confirmed to have any claim-breadth metric. PatentSight+ has a "Patent Strength" help article that returned 403 — [PatentSight+ Patent Strength](https://ps-support.lexisnexisip.com/hc/en-us/articles/50838340843283-Understanding-Patent-Strength-in-PatentSight)
- The assignee of the claim-breadth patent family above is unverified.

---

## Q4. What visualizations does each offer, and what do users say?

### Takeaway
Every major suite has citation maps and landscape/cluster maps. Derwent ThemeScape is the best-known topographic map. Ambercite (AmberScope) and See-the-Forest are specialists in citation networks. User and commentator feedback is consistent: the maps look impressive but need manual configuration and often don't yield decision-grade insight.

### Cited Findings
- **Derwent Innovation / Patent Search**: citation mapping, text clustering, ThemeScape landscape maps; DWPI plus DPCI data. A comparison blog calls ThemeScape the "gold standard", with a steep learning curve and visualizations that "demand manual configuration before they produce insight" (low-reliability source) — [beyondelevation comparison](https://beyondelevation.com/blog/posts/patent-data-visualization-compared/); [Derwent citation map requirements](https://support.clarivate.com/Patents/s/article/Derwent-Innovation-Citation-map-requirements?language=en_US)
- **AmberScope** (Ambercite): network of backward and forward citations to a focus patent, including the cross-links among them. It keeps the most similar and important patents and clusters patents that cross-cite — [AmberScope](https://www.ambercite.com/amberscope)
- **See-the-Forest / IPVision**: single-patent landscape maps (citations to and from one patent) and interconnection maps for up to 100 patents. The x-axis is time; each box is a US patent placed at its issue date, with a tail back to its filing date; lines are prior-art citations. The coverage described is US patents — [See-the-Forest interconnection maps help](http://www.see-the-forest.com/help/general/maps_interconnection.php); [See-the-Forest](http://www.see-the-forest.com/G4/Main.act); [Entrepreneur](https://www.entrepreneur.com/leadership/ever-heard-of-a-patent-map-they-can-help-predict-the/231160)
- **Patent iNSIGHT Pro**: multi-generation citation tree visualiser and assignee co-citation matrices — [Patent iNSIGHT Pro](https://www.patentinsightpro.com/)
- **Lens.org PatCite**: open mapping of scholarly works cited in patents, with filtering and sorting of citing patents to "discover new partners and collaborators" — [PatCite](https://about.lens.org/patcite-linking-patents-and-scholarship/); [PatCite tutorial](https://support.lens.org/knowledge-base/patcite-analysis-tutorial/)
- **Orbit**: citation exploration of cited/citing families and top assignees — [Orbit citation results](https://intelligence.help.questel.com/en/support/solutions/articles/77000437216-explore-results-of-your-citation-search)
- **PatSnap**: citation map and landscape views. Analytics Premium adds "product patent mapping" — [PatSnap pricing](https://www.patsnap.com/pricing)
- **PatentSight+**: portfolio-benchmark charts (PAI vs portfolio size, etc.). Cipher classifiers feed technology taxonomies — [PatentSight+](https://www.lexisnexisip.com/resources/welcome-to-lexisnexis-patentsight-plus/)
- **Relecura**: G2 reviews exist but were not read in detail — [G2 Relecura](https://www.g2.com/products/relecura/reviews)
- The **USPTO** has published a "Seeing the Forest AND the Trees" visualization (not the same as see-the-forest.com) — [USPTO developer](https://developer.uspto.gov/visualization/seeing-forest-and-trees)

### Inferences
- The visual gap is a map that encodes commercial signals (deal status, licensee fit) on top of citations, not just technical proximity. None of the maps above overlays deal or licensing data.

### Gaps
- Systematic user-review quotes (G2/Capterra) on specific visualization strengths and weaknesses were not collected, apart from the comparison-blog remarks.
- Ownership-tree visuals (corporate hierarchy) are known in PatentSight+ and IPlytics ("Ultimate Owner"), but no visualization details were verified.

---

## Q5. Patent value/quality scores: how computed?

### Takeaway
There are three families of approach. (1) Citation × market: PatentSight Competitive Impact and Orbit Patent Strength/Value. (2) Multi-factor percentile composites: AcclaimIP P-Score, Innography PatentStrength (litigation-likelihood trained), Relecura Star Rating. (3) Network centrality: AmberScore.

### Cited Findings
- **PatentSight**: Competitive Impact = Technology Relevance × Market Coverage. Market Coverage is the GNI of countries with protection, relative to the US. Competitive Impact is stated relative to families in the same field (a value of 3 = three times the field average). Patent Asset Index = sum of Competitive Impact across a portfolio. The original academic paper is Ernst & Omland, "The Patent Asset Index – A new approach to benchmark patent portfolios" — [LexisNexis PAI PDF](https://www.lexisnexisip.com/wp-content/uploads/2024/06/The-Patent-Asset-Index.pdf); [ResearchGate paper](https://www.researchgate.net/publication/222968187_The_Patent_Asset_Index_-_A_new_approach_to_benchmark_patent_portfolios)
- **Orbit**: Technology Impact (age- and domain-corrected forward citations, average = 1); Market Strategy (GDP of countries where the family is granted or pending, with a 40% reduction for pending); Patent Strength = Technology Impact merged with Market Strategy; Patent Value adds forward citations, GDP and remaining life weighted against maximum life — [Orbit value metrics](https://intelligence.help.questel.com/en/support/solutions/articles/77000473131-patent-metrics-value-metrics); [Orbit patent value indexes](https://www.questel.com/communication/patent-value-indexes-en.html)
- **AcclaimIP P-Score**: weighted average of C-Score (citation), T-Score and L-Score, normalized to percentiles 0–99 against all patents. The T-Score is computed on the CPC class, not the patent: class growth, renewal, **transaction rates** and allowance rates, with the CPC hierarchy taken into account. It uses "30 to 30,000 data points" — [Anaqua / AcclaimIP](https://www.anaqua.com/resources/patent-scores-and-how-to-use-them-acclaimip/)
- **Innography PatentStrength**: 0–100; more than 30 variables; trained to predict the likelihood of eventual litigation — [Innography](https://www.innography.com/why-innography/patentstrength)
- **Relecura Star Rating**: 0–5 in 0.5 steps; mixes technology, business and litigation factors; 3 or more = "high value". Also a Custom Formula Builder so users can define their own ratings as an alternative to black-box scores — [PIUG note on Relecura Custom Ratings](https://wiki.piug.org/display/PIUG/2017/07/31/Relecura+introduces+Custom+Ratings+for+patent+and+portfolio+analysis); [Relecura](https://relecura.ai/tag/patent-portfolio-analysis/)
- **IPlytics**: AI-predicted claim essentiality and portfolio value for SEPs — [IPlytics](https://www.lexisnexisip.com/solutions/ip-analytics-and-intelligence/iplytics/)

### Inferences
- All of these scores are general-purpose (cross-industry) and value-oriented. None is tuned to biotech realities: patent term vs regulatory exclusivity, Orange/Purple Book listing, or the fact that a small number of composition-of-matter claims carries most of the value.

### Gaps
- The published validation of each score against real transaction values was not reviewed. The PatentSight academic paper exists but was not read in full.

---

## Q6. Links to deal / licensing / transaction data

### Takeaway
Transaction links are weak and mostly limited to assignment or reassignment data. PatSnap (2017) claimed a deal-history likelihood; AcclaimIP uses class-level "transaction rates"; Unified Patents covers the secondary market, litigation and PTAB; IPlytics covers SEP licensing context. None was found to link citations to biopharma licensing or M&A deal terms.

### Cited Findings
- PatSnap Licensee Locator: "likelihood to license, based on previous deals" (2017) — [Research Live](https://www.research-live.com/article/news/patsnap-launches-automated-tool-for-rd-licensing/id/5031572)
- AcclaimIP T-Score uses CPC-level transaction (assignment) rates — [Anaqua / AcclaimIP](https://www.anaqua.com/resources/patent-scores-and-how-to-use-them-acclaimip/)
- **Unified Patents Portal**: free PTAB and district-court litigation data on every US patent detail page; CITX/BRIX search filters; daily litigation alerts. Membership is $395/yr for companies under $30M revenue, and $50k–$490k for larger members (member benefits include secondary-market tracking and patent-quality analytics) — [Unified Portal PTAB/litigation](https://support.unifiedpatents.com/hc/en-us/articles/360024136534-Portal-patent-detail-view-now-displays-PTAB-and-litigation-data); [Patents Post-Grant](https://www.patentspostgrant.com/2019/03/free-ptab-portal-research-analytics/); [Unified Join](https://www.unifiedpatents.com/join)
- PatSnap Synapse (biopharma intelligence: clinical trials, competitive data) sits next to PatSnap's patent products. It is freemium to premium — [PatSnap pricing](https://www.patsnap.com/pricing)

### Gaps
- Whether PatentSight+, Derwent or Orbit ingest licensing or M&A deal databases was not verified. None of them markets that.

---

## Q7. Pricing and target buyers

### Takeaway
The enterprise suites (Derwent, PatSnap, PatentSight, Orbit) are quote-only, with reported ranges from mid-five figures to six figures per year. They sell to corporate IP departments and law firms. Low-cost or free options are Lens.org, Google Patents, the Unified Patents free portal, See-the-Forest (free tier, $250/mo premium) and the PatSnap Eureka Pro tier ($100–200/mo, an AI-agent product, not full Analytics).

### Cited Findings
- **Derwent**: reported $40K–$80K/yr, with a range of $30K to $120K+ including ThemeScape and Derwent Data Analyzer (low-reliability blog) — [beyondelevation](https://beyondelevation.com/blog/posts/patent-data-visualization-compared/)
- **PatSnap**: no public price list for Analytics. Reported entry contracts are $15K–$30K/yr for a few seats, $50K+ with add-on modules, and six figures for enterprise (low-reliability blog). Public prices: Eureka Pro $100–200/month; Bio Premium 6,000 searches/yr; Chemical Premium 1,000 searches/month — [PatSnap pricing](https://www.patsnap.com/pricing); [beyondelevation PatSnap pricing](https://beyondelevation.com/blog/posts/patsnap-pricing-2026/)
- **See-the-Forest**: free tier; premium $250/month; larger projects up to $100,000 — [Entrepreneur](https://www.entrepreneur.com/leadership/ever-heard-of-a-patent-map-they-can-help-predict-the/231160)
- **Unified Patents**: $395/yr for companies under $30M revenue; $50k–$490k otherwise — [Unified Patents / Patents Post-Grant](https://www.patentspostgrant.com/2019/03/free-ptab-portal-research-analytics/)
- **Lens.org**: free public resource; Scholarly and Patent REST APIs plus bulk downloads (commercial API use is licensed) — [Lens About](https://about.lens.org/); [KAUST Lens API guide](https://library.kaust.edu.sa/apis/lens)
- **Ambercite**: free trial; subscription prices not disclosed — [Ambercite blog](https://www.ambercite.com/amberblog/2024/8/29/ambercite-your-treasure-map-to-quickly-find-companies-for-licensing-your-technology-in-a-180-billion-market)
- **Google Patents**: free. Examiner and third-party citation markers are on each page — [Google Patents](https://patents.google.com/patent/US7433884B2/en)
- **Target buyers**:
  - PatentSight is positioned for portfolio benchmarking by corporate IP and strategy teams, with a data-as-a-service factsheet — [LexisNexis PatentSight factsheet](https://www.lexisnexis.com/community/cfs-file/__key/telligent-evolution-components-attachments/01-72-00-00-00-03-43-63/US_2D00_DaaS_2D00_PatentSight_2D00_Factsheet.pdf)
  - IPlytics targets SEP licensing and litigation teams — [IPlytics](https://www.lexisnexisip.com/solutions/ip-analytics-and-intelligence/iplytics/)
  - Unified Patents targets operating companies defending against NPEs — [Unified FAQ](https://www.unifiedpatents.com/faq)
  - Ambercite targets licensing and search professionals — [Ambercite](https://www.ambercite.com/)

### Gaps
- No public prices found for PatentSight+, Cipher, IPlytics, Orbit, AcclaimIP, Relecura or Patent iNSIGHT Pro.
- Patent iNSIGHT Pro: current ownership and status in 2026 not verified. A PatSeer tag page suggests a connection to PatSeer / Gridlogics, but this is unconfirmed — [PatSeer tag](https://patseer.com/tag/patent-insight-pro/)
- The G2 and Capterra review corpus was not systematically mined.
