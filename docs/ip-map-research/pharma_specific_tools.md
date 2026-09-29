# Pharma- and Biotech-Specific Patent and Exclusivity Intelligence Tools (as of Sep 2026)

Scope note: this is a web-only desk study, about 20 searches and fetches. Most enterprise vendors (Cortellis, Evaluate, GlobalData, IQVIA, Citeline) do not publish prices or detailed field lists. Where a claim comes only from a vendor's own site or blog, it is marked **[vendor claim]**. DrugPatentWatch runs a very large SEO blog, and many third-party-looking results are its own posts. Treat those as vendor content.

## Q1. Which tools map drugs/assets to patents and forecast LOE, and how accurate or transparent are they?

### Takeaway
Drug-to-patent mapping plus LOE dates is a crowded, commoditised layer. DrugPatentWatch, Pharsight (GreyB), Cortellis Generics Intelligence (formerly Newport), Biomedtracker and Patsnap Synapse all do it. Nearly all of them build on the public Orange Book plus litigation and exclusivity data. None of the sources I found publishes a validated accuracy rate for LOE dates. The "predictive" claims are vendor marketing, not audited back-tests.

### Cited Findings
**DrugPatentWatch (DPW)**
- Modules on the current pricing page: "Pharmaceutical Drugs (US & International Patents, Loss-of-Exclusivity Dates, Paragraph IV Challenges)", Biologic Drugs, Deep Research Engine, Excipients, Investigational Drugs, US Drug Patent Litigation (PTAB included), US Drug Prices, US Top Drug Sales — [DPW subscribe page](https://www.drugpatentwatch.com/subscribe.php)
- Adds Purple Book data, FDA BLA databases and PTAB proceedings on top of Orange Book data. Claims "predictive models for Paragraph IV challenge outcomes, generic entry timing, and patent term extension (PTE) success rates" **[vendor claim; no published validation found]** — [Crozdesk summary of DPW](https://crozdesk.com/software/drugpatentwatch); [DPW blog](https://www.drugpatentwatch.com/blog/drug-patent-research-expert-tips-for-using-the-fda-orange-and-purple-books/)
- Public drug pages give an estimated generic launch date. Example: Omnaris has 6 US patents (1 active, 5 expired), with generic launch "estimated to be February 1, 2028" (this example comes via Pharsight/DPW-style pages in search snippets) — [Pharsight Omnaris page](https://pharsight.greyb.com/drug/omnaris-patent-expiration)

**Pharsight (GreyB)**
- Tracks Orange Book listings, exclusivities (including Paragraph IV 180-day), patent expiries, PTAB/litigation opportunities, EP oppositions, patent family trees and Paragraph IV filings. Aimed at generics and pharma launch planning. Claims use by "1000+ leading pharma companies" **[vendor claim]**. No public price. The site does not explicitly describe predictive LOE modelling — [Pharsight](https://pharsight.greyb.com/); [Pharsight expiration lists](https://pharsight.greyb.com/drug-patent-expiration-lists)

**Clarivate Cortellis Generics (& Products) Intelligence (ex-Newport)**
- Shows patent expiry dates, tracks ongoing patent challenges, finds suppliers and models demand. Its LOE analysis rests on "constraining patents, exclusivities and SPCs", with **one date per country**. Update cadence: daily for US patent challenges, weekly for manufacturing/patent intel, monthly or quarterly for market data — [Clarivate product page](https://clarivate.com/life-sciences-healthcare/manufacturing-supply-chain-intelligence/product-intelligence-analytics/) (via search snippet)
- "1.2M+ patents covering 66,000+ companies in 77 countries". Tracks Paragraph IV litigation — [IntuitionLabs Cortellis guide](https://intuitionlabs.ai/articles/clarivate-cortellis-guide) (secondary source)

**Citeline Biomedtracker (Norstella)**
- "tracks companies from discovery to patent expiry, loss of market exclusivity, generic entry, and deal activity". Pharmaprojects has 90,000+ drug profiles, 20,000 of them in active development — [Clinical Leader on Citeline](https://www.clinicalleader.com/doc/citeline-s-pharmaprojects-biomedtracker-solution-0001); [Citeline Pharmaprojects](https://www.citeline.com/en/products-services/clinical/pharmaprojects)

**Evaluate Pharma, GlobalData, IQVIA**
- A secondary source says Evaluate specialises in commercial forecasting (consensus sales, trajectories that reflect expected LOE) and "does NOT excel at patent search". It describes GlobalData as analyst-driven reports and databases (pipeline, trials, deals), and IQVIA as linking pipeline to healthcare and market data — [IntuitionLabs patent-cliff CI article](https://intuitionlabs.ai/articles/competitive-intelligence-patent-cliff)
- GlobalData publishes top-down patent-cliff analyses, for example an estimated $236bn in US revenue lost to LOE between 2025 and 2030 — [GlobalData press](https://www.globaldata.com/media/pharma/big-pharma-prepare-next-patent-cliff-blockbuster-drugs-revenue-losses-loom-says-globaldata/)
- The same source says R&D teams lean on Citeline/Derwent for trial and IP alerts, while commercial teams lean on Evaluate/GlobalData for market forecasts — [IntuitionLabs](https://intuitionlabs.ai/articles/competitive-intelligence-patent-cliff)

**Patsnap Synapse**
- Drug-level "core patent" mapping lives in Synapse. Patsnap Bio added "Patented Drug" and "Drug Patent Type" filters that link back to Synapse. Patent records show an "estimated expiry date" — [Patsnap Synapse blog](https://synapse.patsnap.com/blog/exploring-the-world-of-sequence-ip-with-patsnap-bio)

**Low-cost and new entrants**
- An "FDA Drug Patent & Loss-of-Exclusivity Calendar" actor by "priori_intelligence" is sold on Apify, and RxDataLab sells an "FDA Drug Exclusivity Database" dashboard. Both show the Orange Book / exclusivity layer being repackaged cheaply — [Apify](https://apify.com/priori_intelligence/priori-drug-loss-of-exclusivity-calendar); [RxDataLab](https://rxdatalab.com/data-products/exclusivity-dashboard/)

**Why LOE is hard**
- The true LOE date needs patents plus PTE (up to 5 years) plus regulatory exclusivities (5-year NCE, 3-year new use, and others) plus litigation outcomes — [IntuitionLabs 2027 LOE calendar](https://intuitionlabs.ai/articles/2027-drug-patent-expirations-loe-calendar); [CRS R46679](https://www.congress.gov/crs-product/R46679)
- In the EU, an SPC can add up to 5 years and a paediatric extension adds 6 more months, so protection can run up to about 25.5 years — [SPS NHS](https://sps.nhs.uk/articles/understanding-biosimilar-and-generic-market-entry/)

### Inferences
- Mapping small molecules to Orange Book patents and dates is table stakes, and it is cheap to rebuild from public FDA, USPTO and PTAB data. Differentiation has to come from (a) transparent derivations (showing which patent, exclusivity or settlement sets the date) and (b) back-tested accuracy. No incumbent publishes either.
- Cortellis collapsing LOE to "one date per country" hides the reasoning, which leaves room for a product that shows its work.

### Gaps
- No independent accuracy study of any vendor's LOE dates turned up. The DPW "predictive model" claims are unverified.
- Evaluate, IQVIA and GlobalData patent/LOE field-level coverage could not be verified from public pages. All three are sold by enterprise quote only.
- Coverage of EU regulatory data exclusivity (8+2+1) was not confirmed for any tool except Cortellis, and there only via "exclusivities and SPCs".

## Q2. Which tools cover biologics (Purple Book, patent dance), sequence claims and antibody/genus claims?

### Takeaway
Biologics and sequence coverage is split into two worlds. Sequence-search tools (Lens PatSeq, GenomeQuest, Patsnap Bio, STN) handle SEQ IDs and CDRs but not LOE. Drug-level tools (DPW, Cortellis) add Purple Book data, but the Purple Book itself is structurally incomplete. Chemical genus (Markush) claims are covered by CAS MARPAT and Derwent DWPIM/MMS, which are expert-searcher tools. Antibody functional-genus claims (claims defined by what the antibody binds or does) are not structurally searchable in any tool I found.

### Cited Findings
**Purple Book limits**
- The Purple Book Continuity Act (Dec 2020) requires the sponsor to list only the patents disclosed in the patent dance under 42 USC 262(l)(3)(A) and (l)(7). If the parties do not dance, the listing is incomplete. Process patents appear only if they were asserted against a specific biosimilar — [Mondaq/Oblon](https://www.oblon.com/the-purple-book-continuity-act); [Center for Biosimilars](https://www.centerforbiosimilars.com/view/opinion-purple-book-patent-listings-are-only-a-first-step)
- About 2% of brand biologic Purple Book listings contain patent information (search-snippet claim; primary source not confirmed) — [search summary citing Purple Book dataset](https://purplebooksearch.fda.gov/patent-list)

**DrugPatentWatch biologics**
- Biologics is a separate add-on module (historically $1,995/yr) — [Crozdesk](https://crozdesk.com/software/drugpatentwatch)

**Lens.org PatSeq (free, non-profit)**
- More than 500 million patent sequences. BLAST+-based PatSeq Finder. Sources: NCBI GenBank patent division, USPTO, EPO, WIPO and CIPO sequence listings, updated monthly. Coverage varies by jurisdiction, and the PatSeq Data app documents it — [Lens PatSeq](https://about.lens.org/patseq-exploring-biological-sequences-in-patents/); [Lens support](https://support.lens.org/knowledge-base/patseq-data/)

**GenomeQuest (Aptean GenomeQuest)**
- Around 300M curated DNA/RNA/protein sequences from several hundred thousand patents. Has an Antibody Module for CDR and chain analysis with interactive visual summaries. LifeQuest pricing, historical: $600/mo single user, $1,500/mo for up to 3 users, $2,500/mo for up to 10 users — [GenomeWeb](https://www.genomeweb.com/informatics/genomequest-rebrands-gq-life-sciences-refocuses-patent-search-market); [Aptean Antibody Module datasheet](https://assets.ctfassets.net/grb5fvwhwnyo/59wBBUyObjxJD7wqTgqmwo/16e558cd560fcd3c383903bb4e1ebe92/Aptean-GenomeQuest-Antibody-Module-Datasheet-en.pdf)

**Patsnap Bio**
- Sequence search across patents, literature and public repositories. Has an antibody mode that separates heavy and light chains and auto-assigns CDRs by numbering scheme. Handles degenerate and modified sequences **[vendor claim]**. Patsnap's own "platforms compared" article is marketing with no independent benchmark — [Patsnap Bio](https://www.patsnap.com/products/bio/); [Patsnap comparison blog](https://www.patsnap.com/resources/blog/articles/antibody-sequence-searching-in-patents-platforms-compared/)

**Markush / chemical genus**
- CAS MARPAT: more than 1.16M Markush structures, covering 1988 onward — [CAS MARPAT](https://www.cas.org/training/documentation/markush)
- Derwent DWPIM: 1.9M Markush structures linked to 768k DWPI records. The Merged Markush Service links to DWPI and INPI's Pharm file. STN lets users search MARPAT and DWPIM together — [Wikipedia/DWPI and Intellogist](https://intellogist.wordpress.com/tag/mms/); [Clarivate Chemical Patents Index](https://clarivate.com/intellectual-property/derwent/chemical-patents-index/)

### Inferences
- A gap stands out: no single tool pairs biologic-level LOE (12-year BPCIA exclusivity plus dance-disclosed patents plus litigation) with sequence/CDR claim mapping. The sequence tools say which patents read on a sequence. The drug tools say when protection ends. Nothing ties the two together per asset.
- Functional antibody genus claims (post-*Amgen v. Sanofi*, 2023) still need attorney judgement. An IP Map that tags claim type (sequence-defined vs. functional genus vs. epitope) would be new, but this is unverified as a market gap and should be confirmed with practitioners.

### Gaps
- Current Aptean GenomeQuest pricing was not verified. The prices above are historical (GenomeWeb, LifeQuest era).
- I could not verify whether any tool models biosimilar entry dates from dance outcomes or BPCIA litigation.
- CAS SciFinder and STN pricing is not public.

## Q3. Does any tool connect patent positions to licensing/M&A deal terms or buyer targeting?

### Takeaway
Only the large suites hold patents and deals under one roof: Cortellis (Deals Intelligence plus Generics/patents), Citeline (Biomedtracker deals plus Pharmaprojects) and GlobalData. In the public material, patents and deals sit in separate modules. None of it shows analysis that links patent strength or remaining exclusivity to deal economics or buyer fit.

### Cited Findings
- Cortellis Deals Intelligence tracks "90,000+ licensing/M&A deals" with financials and structure. Clarivate claims its intelligence informs 70% of top licensing deals (2017 claim) **[vendor claim]** — [IntuitionLabs Cortellis guide](https://intuitionlabs.ai/articles/clarivate-cortellis-guide)
- Biomedtracker covers patent expiry, LOE, generic entry and deal activity in one product — [Clinical Leader](https://www.clinicalleader.com/doc/citeline-s-pharmaprojects-biomedtracker-solution-0001)
- Patsnap Synapse integrates patents, pipeline, trials, deals and news. It claims analysis time drops by 60–70% **[vendor claim]** — [IntuitionLabs](https://intuitionlabs.ai/articles/competitive-intelligence-patent-cliff)
- Pharsight advertises reports on "collaboration opportunities" but gives no deal-term data — [Pharsight](https://pharsight.greyb.com/)

### Inferences
- A "patent position leads to deal value and buyer list" linkage (for example, remaining exclusivity years as a driver of upfront/royalty comps, or buyers ranked by their own LOE exposure in a therapeutic area) was not found in any public product description. This is the most defensible whitespace for an IP Map tied to Solidus deal data.

### Gaps
- I could not see inside Cortellis or Biomedtracker to confirm whether cross-module joins (a deal record linked to the asset's patent expiry) exist in the UI.

## Q4. Pricing and who buys

### Takeaway
Prices fall into three bands. There are free and public tools (Lens, Unified Patents Portal, USPTO ODP, FDA Books). There is a self-serve middle band at roughly $8k–$24k per year per seat (DPW, GenomeQuest). And there is quote-only enterprise pricing (Cortellis, Evaluate, GlobalData, IQVIA, Citeline, CAS/STN, Derwent, Lex Machina). Buyers are generics/biosimilar BD and portfolio teams, pharma CI and LCM teams, IP and litigation law firms, and investors.

### Cited Findings
**DrugPatentWatch prices, Sep 2026**
- Starter: $1,000/mo or $8,000/yr. Basic, limited searches, no export, no alerts.
- Professional: $3,000/mo or $24,000/yr. Unlimited searches, export, alerts, "Deep Research Engine".
- Enterprise: custom.
- Promo: $499 for one month, all access, until Sep 30 2026.
- Source: [DPW subscribe](https://www.drugpatentwatch.com/subscribe.php)

**DrugPatentWatch prices, older (conflicts with the above)**
- Basic $2,995/yr, Premium $3,995/yr, Ultimate $7,995/yr.
- Add-ons: Biologics $1,995/yr, Litigation (district court + PTAB) $3,995/yr, Drug prices $6,995/yr.
- These are older and substantially lower; the prices appear to have roughly tripled — [Crozdesk](https://crozdesk.com/software/drugpatentwatch)

**Cortellis**
- More than 3,000 life-science clients, including all top-30 pharma. Users call the cost a barrier for smaller firms — [IntuitionLabs](https://intuitionlabs.ai/articles/clarivate-cortellis-guide)

**Free tools**
- Unified Patents Portal is free and covers PTAB and district-court analytics, judges and firms, with daily docket updates and free alerts — [Legal500](https://www.legal500.com/intelligence/united-states/intellectual-property/free-ptab-portal-&-research-analytics); [Unified Portal](https://portal.unifiedpatents.com/)
- USPTO Open Data Portal 3.0 (Nov 21 2025) offers full PTAB API access, with records back to 1997 — [patent.dev](https://patent.dev/uspto-open-data-portal-3-0-ptab/)

**Lex Machina (LexisNexis)**
- Has a dedicated ANDA/Hatch-Waxman analytics module (judges, firms, time to trial, outcomes) and publishes ANDA reports covering Paragraph IV district cases and PTAB cases on Orange Book patents. Buyers are law firms. Price not public — [Lex Machina press](https://lexmachina.com/media/press/lex-machina-releases-fourth-hatch-waxman-anda-litigation-report/)

**Other**
- Patexia/LexDana ranks firms and parties in ANDA litigation — [Patexia](https://patexia.com/insight/anda-litigation-report)
- Pharsight is aimed at generics launch planners — [Pharsight](https://pharsight.greyb.com/)

**AI-native patent platforms, general rather than pharma-specific**
- Patlytics: $40M Series B led by SignalFire, $65M raised in total. It plans life-sciences expansion. Claims use by more than 40% of the Am Law 100 **[vendor claim]** — [TAMradar](https://www.tamradar.com/funding-rounds/patlytics-series-b-40m)
- Solve Intelligence: $40M Series B, Dec 2025, focused on drafting and prosecution — [Patentext comparison](https://patentext.com/blog/solve-intelligence-vs-patlytics)
- Cypris does agentic R&D/patent monitoring and serves pharma among other industries — [Cypris](https://cypris.ai/insights/ai-in-drug-discovery-the-patent-landscape-in-2026)
- Patent analytics market: $1.34B in 2026, projected $3.4B by 2032 (unsourced market-sizing claim in snippet) — [TAMradar/Patentext snippet](https://blog.patentext.com/blog-posts/solve-intelligence-vs-patlytics)

### Inferences
- The AI-native wave (2023–2026) is aimed at law-firm workflows: drafting, prosecution, infringement and claim charts. It is not biotech asset intelligence. I found no well-funded AI-native startup doing drug-level LOE, exclusivity and deal linkage.
- DPW's roughly 3x price rise suggests there is pricing power in the mid-market even for mostly public-data products.

### Gaps
- No public prices for Cortellis, Evaluate, GlobalData, IQVIA, Citeline, Derwent, CAS/STN, Lex Machina or Docket Navigator. Industry lore puts these in the five- to six-figure-per-year range, but I found no source to cite.
- Docket Navigator's pharma/ANDA/BPCIA features were not confirmed in this pass.
- I did not identify any biotech-specific AI-native IP startup (drug-level) with confirmed funding.

## Q5. Known gaps and complaints

### Takeaway
Documented complaints are about cost, complexity and overlapping products (Cortellis), plus structural data gaps: Purple Book incompleteness, no accuracy disclosure, and one opaque LOE date per country. Visualisations are mostly timelines, expiry calendars, family trees and litigation dashboards.

### Cited Findings
- Cortellis: "steep learning curve", overlap among Clarivate products "can be confusing", and "expensive, potentially limiting access for smaller firms" — [IntuitionLabs](https://intuitionlabs.ai/articles/clarivate-cortellis-guide)
- Purple Book patent lists depend on the patent dance, so they are incomplete by design — [Center for Biosimilars](https://www.centerforbiosimilars.com/view/opinion-purple-book-patent-listings-are-only-a-first-step)
- Public sequence databases are jurisdiction-specific with weak filtering. NCBI BLAST has no legal status or claim mapping (from a vendor source, but directionally consistent with Lens's own coverage caveats) — [Patsnap](https://www.patsnap.com/resources/blog/articles/antibody-sequence-searching-in-patents-platforms-compared/); [Lens PatSeq Data](https://support.lens.org/knowledge-base/patseq-data/)
- Visualisations seen:
  - GenomeQuest: an interactive antibody summary report with drill-down to alignments — [Aptean datasheet](https://assets.ctfassets.net/grb5fvwhwnyo/59wBBUyObjxJD7wqTgqmwo/16e558cd560fcd3c383903bb4e1ebe92/Aptean-GenomeQuest-Antibody-Module-Datasheet-en.pdf)
  - Pharsight: patent family trees and expiry collections by therapeutic area and year — [Pharsight](https://pharsight.greyb.com/)
  - Unified Patents: PTAB and litigation dashboards — [Unified Portal](https://portal.unifiedpatents.com/)
  - Patsnap: target-to-patents-and-trials navigation — [IntuitionLabs](https://intuitionlabs.ai/articles/competitive-intelligence-patent-cliff)

### Inferences
- Openings for IP Map: (1) show the derivation behind each LOE date, (2) publish back-tested accuracy, (3) join biologic sequence claims to the asset, (4) link patent positions to deal comps and buyer LOE exposure, and (5) price below enterprise suites.

### Gaps
- No systematic user-review data (G2 and similar) was gathered for the pharma-specific tools. The complaints above rest on one secondary source for Cortellis.
