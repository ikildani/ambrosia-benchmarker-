# Genus, functional and Markush claim risk in biotech/pharma after Amgen v. Sanofi (US focus, as of Sep 2026)

Scope note: describes the law and detectable text signals for a claim-strength scoring module. Not legal advice. Research run on 2026-09-28; about 20 search/fetch calls, so coverage of district courts and vendor tools is thin (see Gaps).

## Q1. Amgen v. Sanofi (598 U.S. 594, 2023): the holding and the "full scope" requirement

### Takeaway
A unanimous Court held Amgen's PCSK9 antibody genus claims, which were defined by function (bind PCSK9 at particular residues and block LDL-receptor binding), not enabled. The specification had to enable the entire claimed class. A "roadmap" of screening, or "conservative substitution" off 26 disclosed antibodies, only handed readers "research assignments." A general quality common to every functional embodiment could have been enough, but Amgen did not disclose one.

### Cited Findings
- "If a patent claims an entire class of processes, machines, manufactures, or compositions of matter, the patent's specification must enable a person skilled in the art to make and use the entire class ... The more one claims, the more one must enable." — [Amgen v. Sanofi slip op.](https://www.supremecourt.gov/opinions/22pdf/21-757_k5g1.pdf)
- Amgen disclosed the amino-acid sequences of 26 antibodies, and the Court said the claims "sweep much broader than those 26," covering "at least millions of candidates." — [Amgen slip op.](https://www.supremecourt.gov/opinions/22pdf/21-757_k5g1.pdf)
- The Court rejected the "roadmap" (make candidates, screen) and "conservative substitution" (mutate known binders, test) theories as "little more than two research assignments," "a hunting license." It used the combination-lock analogy (100 tumblers × 20 positions; 26 working combinations disclosed; all successful combinations claimed). — [Amgen slip op., p.17](https://www.supremecourt.gov/opinions/22pdf/21-757_k5g1.pdf)
- The limits of the holding: a specification need not describe every embodiment. "A specification may call for a reasonable amount of experimentation ... reasonableness in any case will depend on the nature of the invention and the underlying art." A disclosed "quality common to every functional embodiment" (Incandescent Lamp) may suffice. — [Amgen slip op., syllabus & p.17](https://www.supremecourt.gov/opinions/22pdf/21-757_k5g1.pdf)
- CRS summary: claims to an antibody genus were held invalid as not enabled. — [Congress.gov CRS LSB10971](https://www.congress.gov/crs-product/LSB10971)

### Inferences
- In scoring terms, Amgen's risk comes from the ratio of (a) claimed functional scope to (b) disclosed structural species, weighed against (c) whether the specification states a structure-function rule that ties the genus together. A claim is highest risk when it is defined only by function (binding plus a biological effect) and the specification offers screening protocols instead of a common structural feature.
- The Court's own facts give a rough calibration anchor: 26 sequenced species against a functionally defined genus of millions was insufficient.

### Gaps
- Amgen gives no numeric threshold for how many species are enough. Any threshold a scoring module uses is a heuristic, not a legal rule.

---

## Q2. Post-Amgen Federal Circuit and district decisions: what was fatal and what survived

### Takeaway
Composition claims defined by function over a large genus keep losing: Baxalta (2023), Juno (2021, pre-Amgen but consistent), Seagen v. Daiichi (2025) and Xencor (2025). Claims have survived when:
- the claimed genus is a *use of a known class* rather than the class itself (Teva v. Lilly, 2026);
- the challenged "embodiment" is later-arising technology the claim never had to describe (Novartis v. Torrent/Entresto, 2025).

On §101, engineered biological compositions have been held eligible (Regenxbio, 2026), but diagnostic methods have not (CareDx, 2022).

### Cited Findings

**Antibodies / biologics: fatal**
- *Baxalta v. Genentech* (Fed. Cir. 2023): the claims covered antibodies defined by their ability to bind Factor IX/IXa and increase procoagulant activity. They were held not enabled. The court saw "no meaningful difference between Wands' 'undue experimentation' and Amgen's '[un]reasonable experimentation' standards" and did not read Amgen as disturbing the Wands analysis. — [Akin summary](https://www.akingump.com/en/insights/blogs/ip-newsflash/in-the-aftermath-of-amgen-v-sanofi-federal-circuit-finds-functional-antibody-claims-invalid-for-lack-of-enablement); [Venable (Oct 2025)](https://www.venable.com/insights/publications/2025/10/ai-and-enablement-after-amgen-v-sanofi)
- Practitioner read of Baxalta and Amgen together: broad genus claims "are unlikely to be enabled by a specification that merely describes methods by which species of that genus can be identified"; the specification should "identify some general quality common to members of the genus." — [Venable (Oct 2025)](https://www.venable.com/insights/publications/2025/10/ai-and-enablement-after-amgen-v-sanofi)
- *In re Xencor* (Fed. Cir. Mar. 13, 2025, 130 F.4th 1350): affirmed the rejection of anti-C5 antibody Fc-variant (M428L/N434S) method claims, including a Jepson claim, for lack of written description. The main holdings:
  - A Jepson preamble is limiting and needs written description. The applicant must show that what it calls well known in the art really is well known.
  - The specification disclosed only one anti-C5 antibody (5G1.1), had no treatment data or working examples, and did not define "treating."
  - "Treating a patient," with no disease, population or dose attached, "expanded the written-description burden."
  - Narrowing the antibody element through §112(f) did not cure the gap in the broad treatment limitation.
  — [Foley & Lardner (Jul 2026)](https://www.foley.com/insights/publications/2026/07/pharmaceutical-method-of-use-claims-after-teva-v-eli-lilly-and-in-re-xencor-written-description-enablement-and-the-known-compound-genus/); [Goodwin](https://www.goodwinlaw.com/en/insights/publications/2025/03/alerts-lifesciences-ip-the-court-of-appeals-for-the-federal-circuit)
- *Seagen v. Daiichi Sankyo* (Fed. Cir. Dec. 2, 2025, No. 23-2424): the ADC claim to a tetrapeptide linker made only of Gly/Phe failed written description. The priority disclosure covered di- to dodecapeptides with 83 possible amino acids per position, more than 47 million tetrapeptides, and gave no "blaze marks" pointing to the claimed subgenus. It also failed enablement, because the functional limitation ("intracellularly cleaved") covered millions of embodiments with no disclosed "quality common to every functional embodiment." The court vacated the $42M jury award plus 8% running royalty. — [IPKat (Dec 2025)](https://ipkitten.blogspot.com/2025/12/strict-us-written-description-and.html)
- DLA Piper reads Amgen, Baxalta, Xencor and *AbbVie v. Janssen* together as suggesting "there may no longer be a way to broadly claim antibodies without limiting claim scope to specific antibody sequences." It proposes CDR-scanning data to support claims with variable positions (e.g., an HCDR3 motif such as X1PX2X3X4WX5 with each Xn picked from a defined list). — [DLA Piper (2025)](https://www.dlapiper.com/en-us/insights/publications/synthesis/2025/cdr-scanning-offers-hope-for-genus-claims-for-antibodies)

**CAR-T: fatal**
- *Juno v. Kite* (Fed. Cir. Aug. 26, 2021, 10 F.4th 1330): reversed a roughly $1.2B verdict. The claims covered CAR nucleic acids with a "binding element that specifically interacts with a selected target." They failed written description even though scFvs and methods of making them were known. The genus was vast, only a few binders were exemplified, and there were no common structural features. The dependent CD19 claims also failed: the set of possible CD19 scFvs was vast, at most five were known, and the specification did not say which ones bind CD19. — [CAFC opinion](https://www.cafc.uscourts.gov/opinions-orders/20-1758.opinion.8-26-2021_1825257.pdf); [Wolf Greenfield](https://wolfgreenfield.com/articles/kite-flies-away-with-car-t-patent-challenge-win-based-on-written-description-battle)

**Method of treatment with a known genus: survived**
- *Teva v. Eli Lilly* (Fed. Cir. Apr. 16, 2026, 172 F.4th 1367): reversed JMOL and reinstated the jury verdict of validity and willful indirect infringement. The claims covered methods of treating headache with humanized anti-CGRP antagonist antibodies ('045, '907, '908 patents).
  - Enablement: the relevant "research assignment" was using the antibodies to treat headache, not making every antibody. Obtaining more antibodies was "more akin to extra credit than a necessary research assignment," because the specification taught that such antibodies treat headache and the antibodies and humanization methods were already known.
  - Written description was satisfied even though only one humanized antibody (G1) was disclosed.
  - The court distinguished *Rochester*, *Ariad* and *Idenix*: in *Idenix*, the record did not show that all the claimed nucleosides treated HCV.
  - The jury-verdict posture, with clear-and-convincing review, mattered.
  — [Foley & Lardner](https://www.foley.com/insights/publications/2026/07/pharmaceutical-method-of-use-claims-after-teva-v-eli-lilly-and-in-re-xencor-written-description-enablement-and-the-known-compound-genus/); [IPWatchdog](https://ipwatchdog.com/2026/04/16/federal-circuit-distinguishes-amgen-reversal-invalidation-teva-headache-treatment-patents/); [Morgan Lewis](https://www.morganlewis.com/pubs/2026/04/federal-circuit-breathes-new-life-into-methods-claiming-use-of-an-antibody-genus)
- Commentators read Teva as drawing a line between method-of-use claims and article (composition) claims under §112. — [Dinsmore](https://www.dinsmore.com/publications/teva-v-lilly-limiting-amgens-reach-on-written-description-and-enablement/); [Cooley](https://www.cooley.com/news/insight/2026/2026-04-30-what-teva-v-eli-lilly-means-for-written-description-and-enablement-of-method-of-use-patents)

**Small molecule / combination: survived**
- *Novartis v. Torrent* (Entresto; Fed. Cir. Jan. 10, 2025, No. 23-2218): reversed the written-description invalidity ruling and affirmed no invalidity for enablement or obviousness. The valsartan-sacubitril "complex" was discovered four years after priority. "Because the '659 patent does not claim valsartan-sacubitril complexes, those complexes need not have been described." After-arising technology need not be described or enabled but can still infringe. — [CAFC opinion](https://www.cafc.uscourts.gov/opinions-orders/23-2218.OPINION.1-10-2025_2448627.pdf); [Cooley](https://www.cooley.com/news/insight/2025/2025-01-21-precedential-federal-circuit-decision-overturns-lack-of-written-description-based-on-later-discovered-technology)
- *Idenix v. Gilead* (2019): cited in Teva as a case where the record did not support that all claimed nucleosides treated HCV (a method-of-treatment genus that failed). — [Foley & Lardner](https://www.foley.com/insights/publications/2026/07/pharmaceutical-method-of-use-claims-after-teva-v-eli-lilly-and-in-re-xencor-written-description-enablement-and-the-known-compound-genus/)

**Gene therapy / §101: survived**
- *REGENXBIO v. Sarepta* (Fed. Cir. Feb. 2026, precedential) reversed a §101 invalidation. The claims covered a cultured host cell containing a recombinant nucleic acid with an AAV capsid sequence and a non-AAV sequence from different species. These were "markedly different" from nature, and the court refused to disregard conventional limitations in the markedly-different analysis. — [Ropes & Gray (Apr 2026)](https://www.ropesgray.com/en/insights/alerts/2026/04/navigating-the-section-101-landscape-regenxbio-v-sarepta); [Steptoe](https://www.steptoe.com/en/news-publications/step-into-ip-blog/federal-circuit-holds-gene-therapy-claims-patent-eligible-in-regenxbio-v-sarepta.html)

**Beyond biotech**
- The Federal Circuit is now applying Amgen full-scope enablement to broad mechanical and functional claims too. — [Baker Botts (Jan 2026)](https://www.bakerbotts.com/thought-leadership/publications/2026/january/post-amgen-enablement)

### Inferences
- **Claim category is one of the strongest single modifiers.** The pattern across the cases:
  - A composition claim to a functionally defined genus is the highest risk (Amgen, Baxalta, Juno, Seagen).
  - A method of treatment using a *known, pre-existing* class, where the specification shows the class works for the stated use, is lower risk (Teva).
  - A method of treatment with an untethered "treating a patient," no data and a single example is high risk (Xencor).
- **Procedural posture changes outcomes.** Teva survived on jury deference, while Xencor lost under deference to the Board's fact findings. A scoring model should keep "textual vulnerability" separate from "litigation outcome," because the same text can win or lose depending on the forum (PTAB/examination versus a jury).
- **Priority-document support is its own risk.** Seagen turned on whether the *priority* application had blaze marks to the claimed subgenus. A module that scores only the issued specification will miss this. Diffing claims against the earliest priority text is needed.
- **After-arising embodiments** (Entresto) do not by themselves create written-description risk. The scoring should target what the claim literally recites, not what an accused product happens to be.

### Gaps
- I did not retrieve primary text or reliable summaries for *AbbVie v. Janssen*, or for 2024–2026 district-court antibody enablement rulings (e.g., Regeneron/Amgen biosimilar disputes). They are not characterized here.
- The exact number of antibodies Baxalta disclosed (reported in the literature as 11) could not be verified from a fetched primary source, because the Akin page returned 403.
- I found no systematic empirical count of how often post-Amgen functional genus claims survive at the PTAB versus in district court.

---

## Q3. USPTO guidance: 2024 enablement guidelines, antibody practice, sequence-identity claims

### Takeaway
The USPTO's January 10, 2024 guidelines say Amgen changed nothing procedurally: examiners still apply the eight Wands factors. Separately, since 2018 the USPTO no longer accepts disclosure of a newly characterized antigen as written description for an antibody to it. Percent-identity claims need the specification to show which variation is tolerated *and* that the variants keep the function.

### Cited Findings
- On January 10, 2024, the USPTO published "Guidelines for Assessing Enablement in Utility Applications and Patents in View of ... Amgen." They apply to all technologies. The Wands factors remain the framework: breadth; nature of the invention; prior art; skill level; predictability; direction provided; working examples; and the quantity of experimentation. The guidelines are "not intended to announce any major changes." — [Federal Register 2024-00259](https://www.federalregister.gov/documents/2024/01/10/2024-00259/guidelines-for-assessing-enablement-in-utility-applications-and-patents-in-view-of-the-supreme-court); [Venable](https://www.venable.com/insights/publications/2024/01/new-uspto-guidelines-after-the-supreme-courts); [USPTO memo PDF](https://www.uspto.gov/sites/default/files/documents/112a-memo.pdf)
- A February 22, 2018 USPTO memo, following *Amgen v. Sanofi*, 872 F.3d 1367 (Fed. Cir. 2017), told examiners not to use the "newly characterized antigen" test: "adequate written description of a newly characterized antigen alone should not be considered adequate written description of a claimed antibody to that newly characterized antigen, even when preparation of such an antibody is routine and conventional." — [USPTO memo](https://www.uspto.gov/sites/default/files/documents/amgen_22feb2018.pdf); [Nat'l Law Review](https://www.natlawreview.com/article/uspto-withdraws-newly-characterized-antigen-test-written-description-antibodies)
- For percent-identity claims (e.g., "80% identity to SEQ ID NO: 1"), the applicant must show the sequences' actual variation and that each variant performs the desired function. — [Taft Law](https://www.taftlaw.com/news-events/law-bulletins/writing-strong-antibody-claims-avoiding-or-addressing-uspto-rejections-for-written-description-and-enablement/)
- The 2024 guidance "did not prescribe any technical approach" for supporting broader antibody claims, so it is unclear what data will suffice. — [DLA Piper](https://www.dlapiper.com/en-us/insights/publications/synthesis/2025/cdr-scanning-offers-hope-for-genus-claims-for-antibodies)
- A separate 2026 USPTO clarification addressed double patenting and PTA in continuation families (see Q4). — [IPWatchdog (Jun 2026)](https://ipwatchdog.com/2026/06/24/uspto-clarifies-approach-to-double-patenting-and-patent-term-adjustment-in-continuation-families/)

### Inferences
- Percent identity is risky mostly when it is *open-ended and applied to functional regions*: for example, "at least 80/85/90% identical" to a full VH/VL or to CDRs, with no retained-function data and no mapping of which positions can vary. It is less risky when all six CDRs are fixed and identity applies only to framework regions. The scoring module should parse *what* the identity threshold attaches to (CDR vs. framework vs. full-length protein vs. nucleic acid) as well as the number.
- Claims issued before 2018 under the newly-characterized-antigen practice, where the claim is "an antibody that binds antigen X," are a distinct vintage-risk cohort. The issue date is a useful feature.

### Gaps
- I found no USPTO or court-derived numeric safe harbor for identity percentages. "90%" has no special legal status that I could source.
- I did not confirm whether the USPTO issued separate post-Amgen written-description guidelines (as opposed to enablement guidelines) in 2024–2026.

---

## Q4. Other biotech claim risks: ODP/terminal disclaimers, §101, indefiniteness of measured parameters

### Takeaway
- **ODP:** after *Cellect* (2023), a patent's PTA-extended term can be cut off by obviousness-type double patenting against a commonly owned family member. *Allergan v. MSN* (2024) carved out a first-filed, first-issued patent.
- **§101:** diagnostic methods (detect a natural correlation with conventional steps) remain effectively ineligible. Engineered compositions are eligible.
- **Indefiniteness:** formulation claims that recite measured parameters without a measurement method or conditions are exposed under Nautilus.

### Cited Findings
- *In re Cellect*, 81 F.4th 1216 (Fed. Cir. 2023): for ODP, "the relevant expiration date is the expiration date including PTA—not the original expiration date." — [White & Case](https://www.whitecase.com/insight-alert/federal-circuit-limits-application-obviousness-type-double-patenting-patents-same); [DLA Piper](https://www.dlapiper.com/en-us/insights/publications/synthesis/2024/effect-of-patent-term-extensions-on-obviousness-double-patenting)
- *Allergan v. MSN* (Fed. Cir. Aug. 13, 2024, No. 24-1061): a first-filed, first-issued, later-expiring claim cannot be invalidated for ODP by a later-filed, later-issued, earlier-expiring reference with a common priority date. Commentators call it a limited carve-out for a relatively rare fact pattern. — [Troutman](https://www.troutman.com/insights/federal-circuit-decision-clarifies-obviousness-type-double-patenting-and-patent-term-adjustments-in-allergan-v-msn-laboratories/); [Neal Gerber](https://www.nge.com/news-insights/publication/federal-circuit-weighs-in-again-on-obviousness-type-double-patenting-to-limit-in-re-cellect-and-preserve-pta-for-first-filed-first-issued-patents/)
- Patently-O (Aug 2025) discusses challenges to the Allergan "first-issued safe harbor." — [Patently-O](https://patentlyo.com/patent/2025/08/obviousness-patenting-challenging.html)
- *CareDx v. Natera*, 40 F.4th 1371 (Fed. Cir. 2022): cfDNA transplant-rejection detection claims (obtain sample, genotype, sequence/dPCR, determine donor cfDNA) were "directed to a natural law together with conventional steps." A cert petition was filed May 2023. Commentators note the Federal Circuit has invalidated every diagnostic patent before it since *Mayo*. — [DLA Piper](https://www.dlapiper.com/en-us/insights/publications/intellectual-property-news/2023/caredx-v-natera-another-blow-to-eligibility-for-diagnostic-method-patents); [BitLaw](https://www.bitlaw.com/source/cases/patent/CareDx.html)
- In *Teva v. Sandoz*, claims reciting "molecular weight" without saying which average (peak, number or weight) were held indefinite. — [Klarquist Patent Defenses](https://patentdefenses.com/particular-and-distinct-claims-aka-indefiniteness-sec-1122b-other-than-sec-1126f/)
- In *Forest Labs v. Teva*, "plasma concentration-time profile" was treated as an indefinite claim term. — [Chen, Biotechnology Law Report (2019)](https://doi.org/10.1089/blr.2019.29116.phc)
- In the epoprostenol patents case, ambiguous measurement conditions for a chemical property led to affirmed non-infringement: measurement ambiguity cuts against the patentee even short of indefiniteness. — [Duane Morris](https://www.duanemorris.com/alerts/ambiguity_measurement_conditions_relevant_chemical_property_leads_federal_circuit_0526.html)

### Inferences
- **ODP/TD signals** can be scored from bibliographic data rather than claim text: a terminal disclaimer on file, PTA days greater than 0, continuation depth, and whether the patent is first-filed/first-issued in its family. The combination "PTA > 0, not first-issued, commonly owned sibling with overlapping claims, no TD" is the Cellect risk pattern.
- **§101 signals:**
  - Method claims whose steps are detecting/measuring/determining a naturally occurring analyte and correlating it with a condition, with no treatment step and no non-natural composition, are high risk.
  - Claims reciting recombinant, heterologous, engineered or non-naturally-occurring components are lower risk after Regenxbio.
- **Indefiniteness signals:** a numeric parameter (particle size D50/D90, Cmax/AUC/Tmax, molecular weight, viscosity, dissolution %, purity) that has no named test method, apparatus, conditions or averaging basis, either in the claim or in a specification definition.

### Gaps
- I did not source 2024–2026 indefiniteness decisions specific to PK or particle-size claims. The cited cases are older (2014–2019).
- I could not confirm the final disposition of the CareDx cert petition (it is widely reported as denied, but I did not verify it here), or any §101 changes from the PERA legislation as of Sep 2026.

---

## Q5. Automatable signals and published scoring attempts

### Takeaway
Published NLP work measures claim *scope* (breadth), not *§112 validity risk*. Breadth measures based on length and information content are validated as scope proxies. I found no published or validated model that predicts §112 invalidity of biotech genus claims from text. The feature set below is inferred from the case law above.

### Cited Findings
- Independent claim length (word count) and independent-claim count are established scope measures. Breadth is inversely related to the word count of the first independent claim, and text-based measures beat other scope proxies. — [Kuhn & Thompson / Research Policy (2019), "Patent claims and patent scope"](https://www.sciencedirect.com/science/article/abs/pii/S0048733319301052)
- Ragot (arXiv 2309.10003, 2023–24) measures claim scope as the reciprocal of self-information under a language model. LLMs (GPT-2, davinci-002) outperform frequency models, which outperform naive models, and "character count appears to be a more reliable indicator than the word count." — [arXiv](https://arxiv.org/abs/2309.10003)
- Research Policy (2024) examines interpretive aspects of claim language and scope. — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0048733324002208)
- Venable (Oct 2025) discusses how AI-generated sequences and structure prediction interact with post-Amgen enablement: whether computational tools can supply the "common quality." — [Venable](https://www.venable.com/insights/publications/2025/10/ai-and-enablement-after-amgen-v-sanofi)

### Inferences: a candidate feature set (derived from the cases above, not validated)

1. **Functional-only definition** (Amgen, Baxalta, Juno, Seagen).
   - Signal: the product element is defined by verbs like "binds," "inhibits," "blocks," "competes with," "increases," "cleaved," "specifically interacts with" or "capable of," and the same claim has no SEQ ID, CDR sequence or structural formula.
   - Weight: highest for composition claims.
2. **Species-to-genus ratio** (Amgen: 26 vs. millions; Juno: ≤5 binders; Xencor: 1 antibody).
   - Count the distinct SEQ ID NOs / exemplified compounds / Examples with data in the specification.
   - Estimate genus size from the claim: Markush combinatorics (product of alternatives per variable position), variable-residue positions × allowed residues (Seagen: 83 per position → 47M+), or an unbounded functional class.
   - Score log(genus size) − log(species count).
3. **Common structural feature present?**
   - Signal: whether the specification states a consensus motif, a conserved epitope with structure-function data, a CDR-scanning or alanine-scanning table, or an SAR table.
   - Its presence mitigates the risk (Amgen "quality common," DLA CDR-scanning).
4. **Open percent identity.**
   - Parse "at least N% identical/identity/homology" and the region it attaches to (full-length protein, VH/VL, CDR, framework, nucleic acid).
   - Risk rises as N falls, when identity applies to CDRs or functional domains, and when no retained-function limitation or variant data exists (Taft).
5. **Subgenus lacking blaze marks** (Seagen).
   - Compare the claimed subgenus with the priority document's genus. Flag it if the claimed subset is never listed as preferred or exemplified in the priority text.
6. **Method-of-treatment modifiers.**
   - Lower risk (Teva): the product class is pre-existing and known, the specification contains efficacy data for the named indication, and the indication is specific.
   - Higher risk (Xencor, Idenix): "treating a patient" or "a disease" with no named indication, no clinical or animal data, and a single example.
7. **Jepson format** ("In a method/composition ... the improvement comprising"). The preamble needs written-description support (Xencor), so flag Jepson claims whose preamble recites a broad class.
8. **Transitional phrase.** "Comprising" (open) widens scope. "Consisting essentially of" adds construction and indefiniteness litigation risk over what "materially affects basic and novel characteristics." "Consisting of" is narrow. *Note: none of the cases fetched here were CEO cases; this weighting is a practitioner convention I did not source.*
9. **Result-oriented or parameter language without a method** (Teva v. Sandoz, Forest v. Teva). Flag numeric parameters (particle size, PK values, MW, dissolution) that lack a test method or conditions in the claim or specification definitions.
10. **§101 pattern** (CareDx vs. Regenxbio). Flag detect → correlate claims with no treatment step and no engineered component.
11. **Bibliographic ODP risk** (Cellect/Allergan): a TD on file, PTA > 0, family position, and common ownership.
12. **Vintage.** Antibody claims issued before 2018, and genus claims issued before 2023, were examined under looser practice.
13. **Mitigators.** Dependent claims that recite full CDR sets or specific compounds give fallback positions. Score the *best surviving dependent claim*, not just claim 1.

### Gaps
- I found no published dataset linking claim-text features to §112 outcomes in biotech. A labeled training set would have to be built from Federal Circuit/PTAB decisions (Amgen, Baxalta, Juno, Idenix, Xencor, Seagen, Teva, Entresto, etc.).
- I did not research commercial vendors' claim-strength scores (e.g., LexisNexis PatentSight, Clarivate, IPlytics, PatSnap, Patently-style AI tools), so I cannot say whether any vendor models §112 genus risk.

---

## Q6. How practitioners and BD diligence teams grade claim strength

### Takeaway
The sourced practitioner guidance amounts to a red-flag checklist that mirrors the case law:
- breadth that goes beyond the examples;
- functional definitions;
- untethered treatment language;
- Jepson preambles;
- single examples;
- unsupported "well known" assertions.

I found no sourced, standardized numeric grading scale used by BD teams.

### Cited Findings
- Foley's post-Teva/Xencor red flags:
  - broad "treating a patient" language untethered to a disease or population;
  - Jepson preambles treated as limiting;
  - a lack of working examples showing the claimed therapeutic activity;
  - relying on "well known" status without record evidence;
  - §112(f) narrowing that does not cure broader method limitations;
  - single-example disclosures supporting a genus.
  — [Foley & Lardner](https://www.foley.com/insights/publications/2026/07/pharmaceutical-method-of-use-claims-after-teva-v-eli-lilly-and-in-re-xencor-written-description-enablement-and-the-known-compound-genus/)
- Antibody drafting practice has shifted to sequence-defined claims. CDR-sequence claims, including CDR-scanning-supported variable positions, are presented as the primary surviving format. — [DLA Piper](https://www.dlapiper.com/en-us/insights/publications/synthesis/2025/cdr-scanning-offers-hope-for-genus-claims-for-antibodies)
- The US and EPO differ. The US asks whether full scope can be practiced without undue experimentation. The EPO asks whether the skilled person can perform the invention without inventive effort. The Seagen claims that failed in the US are a live comparison. — [IPKat](https://ipkitten.blogspot.com/2025/12/strict-us-written-description-and.html)

**EPO note (G 2/21, March 23, 2023):** post-published evidence cannot be refused just because it post-dates filing, and it may support a technical effect for inventive step. The limit is that the skilled person, using common general knowledge, must be able to derive the effect as encompassed by the teaching and embodied by the invention as originally disclosed. The Board avoided the term "plausibility." Sufficiency (Art. 83) for therapeutic-use claims still needs the effect to be credibly shown in the application as filed. — [J A Kemp](https://www.jakemp.com/knowledge-hub/decision-from-the-enlarged-board-of-appeal-in-g2-21-regarding-the-doctrine-of-plausibility/); [GJE](https://www.gje.com/resources/g-2-21-key-takeaways-for-post-published-evidence-and-plausibility-at-the-epo/); [IPKat on T 116/18](https://ipkitten.blogspot.com/2023/11/clarity-on-interpretation-of-g221-from.html)

### Inferences
- A diligence-grade output should probably report, for each patent:
  - the dominant claim category (composition genus / species / method-of-use of a known class / process / formulation / diagnostic);
  - a §112 genus-risk score (features 1–7 above);
  - §112(b) parameter risk;
  - §101 risk;
  - ODP/term risk;
  - the "best-defended claim," meaning the narrowest claim that still reads on the asset.
- Licensees mainly care whether the claim that covers *their product* survives. A broad claim at risk plus a sequence-specific dependent claim that covers the product can still be a strong position.
- The EPO under G 2/21 is more forgiving on post-filed data for inventive step, but it is still strict on sufficiency for medical-use claims. A dual US/EP score should not assume that a US §112 weakness carries over to Europe, or the other way round.

### Gaps
- I did not find a published, standardized BD licensing-diligence scoring rubric (e.g., from BIO, LES or major pharma BD teams). Checklists appear in law-firm alerts only in narrative form.
- District-court and PTAB statistics on how often antibody genus claims are invalidated after Amgen were not found.
