> ## ⛔ DO NOT SEND — benchmark failed live-data verification (Aug 25, 2026)
>
> The Deal Terms Benchmark was built from a **static April 17, 2026 export**
> (`data/comparable-deals-*.ts`), not a live Solidus query. Verification against the
> live `deals` table (Supabase `mnzoulengniofgkwtfbo`) found the comp set unsafe for
> client use. See "Live verification findings" at the bottom of this file.
>
> The revised **fee proposal** is unaffected on structure, but its platform figures
> must change: the live corpus holds **1,620 deals, not 2,500+**.

# ThalassaX / Chipscreen — August 2026 follow-up package

Deliverables for the stalled Chipscreen (ThalassaX Therapeutics US) engagement.
Last contact: fee proposal + case studies sent Aug 7, 2026. No reply as of Aug 25.

| File | Purpose |
|---|---|
| `Ambrosia_Ventures_Fee_Proposal_ThalassaX_Aug2026.*` | Revised fee proposal (3pp) |
| `Ambrosia_Ventures_Deal_Terms_Benchmark_ThalassaX_Aug2026.*` | Sample Phase 1 deliverable (2pp) |
| `follow-up-email.md` | Email copy + rationale |
| `_doc.css` | Shared print stylesheet |

Rebuild PDFs after editing the HTML:

```
/opt/pw-browsers/chromium --headless --disable-gpu --no-sandbox \
  --no-pdf-header-footer --print-to-pdf=NAME.pdf NAME.html
```

## What changed in the fee proposal, and why

| # | Change | Reason |
|---|---|---|
| 1 | "Steven" → **Stephen**; addressed to **ThalassaX Therapeutics US** | Deck cover page reads *Stephen Xue, General Manager, ThalassaX Therapeutics US*. The Aug 7 email and the original fee proposal both misspelled it, and the proposal was addressed to the wrong entity — a problem if it routes to Shenzhen for signature. |
| 2 | **Phase 1 now credits 100% against the Phase 2 retainer** | The July proposal promised *"the retainer is fully creditable… Ambrosia succeeds only when ThalassaX succeeds."* The August version added $32,500 non-creditable cash at signing with no explanation. That reversal is the most likely reason the deal stalled. This restores July's economics rather than discounting. |
| 3 | **Week 4 interim deliverable reinstated**; full package at Week 12 | July promised the Valuation & Positioning Report in Weeks 1–4. August silently stretched Phase 1 to 12 weeks. Staging it honours both. Second payment now triggers on Week 4 delivery, so he sees output before paying it. |
| 4 | Added an explicit **"Reconciliation with our July proposal"** table | He reads closely — he quoted platform figures back on the call. Better to explain the change than let him find it. |
| 5 | New lead deliverable: **Term Validation** | Deck p30 already states their asking terms. Phase 1 framed as *determining* strategy partly re-does work they think is done; framed as *pressure-testing their own number before a $100–150M raise*, it is an easy internal approval. |
| 6 | Added a **data-handling clause** | On the call he asked whether the platform is "only for your company, or… somewhere outside." The answer — that other users help train the model — is a real concern for a listed parent. Terms now state client data never enters Solidus. |
| 7 | Fee summary restated as two outcomes (stop after Phase 1 / transaction closes) | The prior table listed credits then a total that ignored them. Confusing to a finance reviewer. |
| 8 | Discount range set to **20–40%**; deal count to **2,500+** | See sign-off list below. |
| 9 | Exclusivity scoped to **Phase 2 only** | July proposed exclusive advisor status; Phase 1 exclusivity would add friction for no benefit. **Cut this line if you'd rather not raise it now.** |

## Needs your confirmation before sending

1. **Platform figures do not agree across your own documents.** Deal count: 2,500+ (July) → 1,600+ (Aug fee proposal) → 2,500+ (case studies). Engines: 14 (July) → 30+ (case studies). Stephen quoted "2,500 transactions and 14 engines" back to you on the call, so these documents use **2,500+ and 14**. Confirm the true numbers and **re-issue the case-studies PDF to match** — it is the one still saying 30+.
2. **China-origin discount range.** July said 20–40%; the August fee proposal said 30–50%. These use **20–40%**. That figure carries the entire ROI argument, so it should not move between documents.
3. **Spot-check the twelve comparables.** Terms are as publicly disclosed at announcement, drawn from the hand-audited (`verified`) rows of `data/comparable-deals-supabase.ts` and `data/comparable-deals-extended.ts`. Confirm against source before this goes to a listed company's finance team.
4. **The $300M NewCo post-money is an illustrative assumption**, labelled as such. Their materials state a $100–150M raise but no valuation. Replace with a real figure if you have one.
5. **Success fee held at 4%** and retainer at $24,000/mo — unchanged from the August version.

## Benchmark findings (from Solidus data in this repo)

Comparable set: China-origin licensor, oncology, Phase 1–3, out-licensing, 2023–2026, disclosed terms, de-duplicated. n = 12.

- Upfront: median **$200M**, IQR $100–500M, range $18M–$1,350M
- Total deal value: median **$2,100M**
- Milestone-to-upfront ratio: median **1:10.5**
- ThalassaX proposed: **$35M** upfront (~82% below median), **$563M** total, ratio **1:15.1** (75th percentile)
- Bridge: for the NewCo route to match the median upfront in cash-equivalent terms, the retained 25% must be worth ~$165M at close → implied post-money ≈ **$660M**

Closest structural analogue: **Ascentage → Takeda (2024)** — China-origin, oncology, small molecule, Phase 2, ex-China rights, $100M upfront / $1,300M total.

Note on the ratio: an earlier read guessed ThalassaX's back-loading was a clear outlier. The data is more precise — 1:15.1 sits at the 75th percentile, elevated but inside the range. The **upfront level**, not the ratio, is the real gap.


---

# Live verification findings (Aug 25, 2026)

Queried the live Solidus `deals` table directly. The benchmark's comparable set does not
survive it.

## 1. The platform figures in client documents are overstated

| Claim | Where it appears | Live value |
|---|---|---|
| 2,500+ curated deals | July proposal, case studies PDF | **1,620** |
| 1,600+ curated deals | Aug fee proposal | **accurate** |
| 14 engines / 30+ engines | July / case studies | not verified — still needs checking |

The August fee proposal was the correct one. My earlier recommendation to standardise on
"2,500+" was wrong and has been reversed in the fee proposal.

## 2. Provenance is thin

- 1,620 deals total; 609 with `verification_status = 'verified'`
- **Only 57 verified rows carry a source URL** (3.5% of the corpus)
- Most comps used in the benchmark have `source_type = 'manual'` and `source_url = null`

## 3. The `verified` flag is not reliable

- 287 rows have slug-style placeholder asset names (`lung_nsclc`, `solid_tumors`,
  `breast_her2`, `hematologic_malignancies`)
- **221 of those are marked `verified = true`**

This is the pattern `supabase/migrations/051_flag_fabricated_deals.sql` exists to catch.
Ten of the benchmark's twelve comps come from this population.

## 4. Two named claims in the benchmark are factually wrong

- **"Hengrui → GSK, $500M upfront, Phase 1 small molecule, oncology"** — the live record
  is **HRS-9821, a PDE3/4 inhibitor for COPD**, not oncology. The "28x spread between GSK
  and Glenmark" observation is built on a mis-tagged respiratory deal.
- **"Ascentage → Takeda — closest structural analogue to Chiauranib"** — the live record is
  **olverembatinib in CML**, Phase 3 heme, not a Phase 2 solid-tumour small molecule.

## 5. Heavy duplication inflates any aggregate

The same transaction appears repeatedly with conflicting terms: 3SBio/Pfizer across 5 rows
($1.2B-$1.3B upfront, `option` and `license`, phase `unknown` and `phase_3`);
Hengrui/BMS across 8+; Ascentage/Takeda across 4. Any median computed without
transaction-level de-duplication is unreliable.

## Path to a sendable version

1. De-duplicate at transaction level (licensor + licensee + asset + announcement).
2. Restrict to rows with a real asset name **and** a resolvable source URL.
3. Hand-verify each surviving comp against its primary source.
4. If fewer than ~8 survive, present it as a **curated, individually sourced comp set** with
   citations per row — not as a database median. Smaller and sourced beats larger and unverifiable.

Separately, the corpus issues above are worth addressing independent of this client: 3.5%
source coverage and a `verified` flag that passes 221 placeholder rows will not survive
diligence from any buyer who looks closely.
