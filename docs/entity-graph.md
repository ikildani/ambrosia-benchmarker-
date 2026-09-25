# Shared entity graph

Workstream 3 of the Alaric outcomes program (`docs/alaric-outcomes-program.md`, Sequencing §3). One page: the canonical ids, the resolve contract, the duplicate-row situation in `companies`, and the rule for Terrain and Augur.

## Canonical identifiers

| Entity | Canonical id | Table | Rows (Sep 25 2026) |
|---|---|---|---|
| Organisation | `companies.id` | `companies` (name, `name_variations text[]`, `ticker`, `cik` / `sec_cik`, `company_type`, `owner_type`, hq) | 29,889 |
| Asset | `drug_master.id` | `drug_master` (+ `drug_aliases.alias_normalized`, `drug_owners`) | 54,905 (159,822 aliases) |
| Transaction | `deals.id` | `deals` (`licensor_id` / `licensee_id` already point at `companies.id` on ~2,050 of 2,072 rows) | 2,072 (312 pass the quality filter) |

Nothing else is a key. A name string, a ticker, an INN, a ChEMBL id are all *lookups* that resolve to one of the three ids above.

### The rule for Terrain and Augur

**Store the Solidus id, never your own name string.** When a Terrain indication page or an Augur portfolio row refers to a company, asset or deal, it stores `companies.id` / `drug_master.id` / `deals.id` obtained from `POST /api/entities/resolve`, and reads the display name back from `GET /api/entities/:kind/:id`. Free text is kept only as `*_raw` provenance next to the id, never as the join key. Unresolved references (resolve returned `null`) are stored with the id column null and the raw string, and re-tried by a nightly job; they are never "resolved" by string-equality on the consuming side.

## Resolve contract

`POST /api/entities/resolve` — body `{ items: [...] }`, at most **50** items per call. Auth: header `x-api-key` equal to the `ENTITY_API_KEY` environment variable (server-to-server from Terrain / Augur), or a Solidus session cookie / bearer token. Rate limit: the default public bucket (60 / minute per key holder or user). Identical items are served from a 10-minute in-memory cache.

Item shapes (all fields optional except `kind`, at least one query field required):

```json
{ "kind": "company", "name": "Eli Lilly and Company" }
{ "kind": "company", "id": "3c849b12-…" }
{ "kind": "company", "ticker": "LLY" }
{ "kind": "company", "cik": "59478" }
{ "kind": "asset",   "name": "Keytruda" }
{ "kind": "asset",   "inn": "pembrolizumab" }
{ "kind": "asset",   "unii": "DPT0O3T46P" }
{ "kind": "asset",   "chembl_id": "CHEMBL3137343" }
{ "kind": "deal",    "id": "cbb8b877-…" }
{ "kind": "deal",    "licensor": "AstraZeneca", "licensee": "Merck", "announced_date": "2026-07-20" }
```

Response — `results` and `candidates` are both in input order:

```json
{
  "results": [
    {
      "kind": "company",
      "id": "3c849b12-4a78-4d75-b1c3-e3e5a9d6a83a",
      "canonicalName": "Eli Lilly",
      "confidence": 0.98,
      "matchedOn": "exact",
      "aliases": ["Eli Lilly", "Eli Lilly and Company", "Lilly", "Eli Lilly & Co."],
      "meta": {
        "companyType": "large_pharma", "ownerType": "industry",
        "hqCountry": "US", "hqRegion": null,
        "ticker": "LLY", "cik": "59478", "dataQualityScore": 100,
        "duplicateIds": []
      }
    },
    null
  ],
  "candidates": [
    [],
    [
      { "kind": "company", "id": "946a722b-…", "canonicalName": "Pfizer", "score": 0.667 },
      { "kind": "company", "id": "…", "canonicalName": "Pfizer Oncology", "score": 0.667 }
    ]
  ]
}
```

Match order and the confidence each carries:

| Stage | `matchedOn` | `confidence` | Companies | Assets | Deals |
|---|---|---|---|---|---|
| 1 | `id` | 1.0 | `id`, `ticker`, `cik` (either cik column, zero-padded or not) | `id`, `unii`, `chembl_id` | `id` |
| 2 | `exact` | 0.98 | normalised name equal (spacing ignored) | `inn` or `preferred_name` equal, case-insensitive | all supplied parties equal after normalisation and same announced date |
| 3 | `alias` | 0.95 | `name_variations` entry equal after normalisation | `drug_aliases.alias_normalized` equal | — |
| 4 | `fuzzy` | similarity | trigram similarity ≥ **0.85** on normalised names | same, over aliases sharing the first four characters; code names (ABC-123) are never fuzzy-matched | 0.7 × party-name similarity + 0.3 × date proximity (±45 days) ≥ 0.85, and no runner-up within 0.02 |
| — | `null` | — | top 3 near misses ≥ 0.4 returned in `candidates` | same | same |

Normalisation (`lib/entities/normalize.ts`): NFKC-fold, lowercase, `&` → `and`, punctuation → space, then trailing legal forms are dropped repeatedly (`inc`, `ltd`, `ag`, `plc`, `gmbh`, `co`, `company`, `kabushiki kaisha`, …) together with the connector they leave behind, so *Eli Lilly and Company*, *Eli Lilly & Co.* and *Eli Lilly* all become `eli lilly`. Tokens that distinguish real organisations are kept on purpose: `holding` (Roche ≠ Roche Holding AG), `kgaa` (Merck KGaA ≠ Merck & Co), `oncology`, `japan`. Assets use the `drug_aliases.alias_normalized` key (alphanumerics only) so alias hits use the existing index.

Similarity is pg_trgm-style: each word is padded with two leading and one trailing space, trigrams are taken, and the score is |A ∩ B| / |A ∪ B|. At 0.85 the threshold is strict: a one-character deviation clears it only in longer names (*Vertex Pharmaceutical* vs *Vertex Pharmaceuticals* = 0.875); *Kyowa Kirinn* vs *Kyowa Kirin* = 0.77 and *Roche* vs *Roche Holding* = 0.43 are returned as candidates, never matched.

Deals are resolved only among rows that pass the product-wide quality filter (`is_synthetic = false`, `is_canonical` not false, `verification_status` not in rejected / flagged). A single party name that fits two deals equally is ambiguous and returns candidates.

### Lookup

`GET /api/entities/:kind/:id` (same auth) returns the canonical record:

- **company** — `name`, `aliases` (own name, `name_variations`, duplicate rows' names), `hq {country, region}`, `type`, `ownerType`, `ids {ticker, cik, website}`, `dataQualityScore`, `duplicateIds`.
- **asset** — `preferredName`, `inn`, `aliases`, `modality`, `target`, `mechanism`, `maxPhase`, `isCombination`, `componentDrugIds`, `originatorCompanyId`, `ids {unii, chemblId, drugbankId, casNumber, pubchemCid}`, `owners [{companyId, role, territory}]`.
- **deal** — `parties {licensor {id, name}, licensee {id, name}}` (ids are `companies.id`; a dangling or missing id is re-resolved by exact name/alias, else null), `asset {id, name}` (`drug_master.id` when the asset name has one unambiguous alias), `announcedDate`, `dealType`, `phaseAtSigning`, `therapeuticArea`, `indication`, `terms` in **$M** (`upfrontM`, `milestonesM`, `totalM`, `royaltyLowPct`, `royaltyHighPct`, `termsDisclosed`), `sourceUrl`, `verificationStatus`. Deals outside the quality filter are 404.

## Duplicate rows in `companies` (measured Sep 25 2026, read-only)

`tmp/entity-dup-count.ts` and `tmp/entity-live2.ts` (gitignored) paged all 29,889 rows and grouped them by the normalised name above with spacing ignored:

| Population | Groups with > 1 row | Surplus rows |
|---|---|---|
| All rows | **684** | **807** |
| `owner_type = 'industry'` only | 470 | 552 |
| Rows with a `company_type` (the enriched partner set) | 27 | 27 |
| Groups that contain a row referenced by `deals.licensor_id` / `licensee_id` | 165 | — |

Only 6 groups are exact lower-case duplicates; the rest differ by legal form or punctuation (*Janssen-Cilag* alone has 10 rows: N.V./S.A., S.p.A., Pty Ltd, G.m.b.H, Ltd., Limited, S.A.S., B.V., S.A.). Nearly all come from trial-registry sponsor strings (`source_registry = 'ctgov'`, 23,481 rows) landing next to the enriched partner row. The resolver already hides this: the best-populated row wins (`data_quality_score` + revenue + `deals_last_24mo` + classification) and the rest are reported in `meta.duplicateIds`.

Two hazards found on the way, both for the merge job:

1. `deals.licensor_id` / `licensee_id` do not always point at the best-populated row. The Jul 2026 AstraZeneca → Merck (Lynparza) deal has `licensor_id` = *Alexion (AstraZeneca)*, because that subsidiary row lists "AstraZeneca" in its `name_variations`. Subsidiary rows borrowing the parent's name as a variation will mis-route alias matches whenever no exact-name row exists; the name resolver is safe here only because an exact *AstraZeneca* row exists and exact beats alias.
2. `drug_aliases` carries combination-partner names as aliases of the wrong drug (pembrolizumab's alias list includes nivolumab, OPDIVO, cadonilimab from combo-arm strings). Brand/INN lookups still land on the right row because the externally-resolved row outranks internal placeholders, but the ambiguity shows up in `candidates` at 0.95 and should be cleaned at the source.

## Follow-ups

- **Merge job for duplicate companies** (not written; needs a decision on write access). Input: `meta.duplicateIds` from a full-table resolve, or the grouping script above. For each group: keep the best-populated row, union `name_variations`, repoint `deals.licensor_id` / `licensee_id`, `drug_owners.company_id`, `clinical_assets` sponsor ids, `counterparty_premiums.company_id` and `partner` rows to the survivor, then soft-delete the rest (or keep them with a `merged_into` column so old ids still resolve). Strip a parent's name from a subsidiary's `name_variations` first (hazard 1).
- **Terrain**: replace `company_name` / `asset_name` text keys on indication competitive-density and pipeline rows with `company_id` / `asset_id` (`companies.id` / `drug_master.id`) filled through `/api/entities/resolve`; keep the raw strings as `*_raw`. Expose the demand-layer API keyed on those ids (Sequencing §4).
- **Augur**: portfolio companies and rounds store `companies.id`; exits that are licensing deals store `deals.id`. NAV marks vs later rounds join on the id, not the name.
- **Deal coverage**: only 312 of 2,072 deals pass the quality filter today (1,496 are rejected / flagged, 913 non-canonical), so deal resolution covers the verified core only; the outcome resolver (Workstream 1) should expect nulls for older or unverified deals until the backfill validator has been re-run.
- **Env**: set `ENTITY_API_KEY` in Vercel (production + preview) and share it with the Terrain and Augur deployments; rotate by replacing the value (no key table yet). Without it, only session-authenticated Solidus users can call the routes.
