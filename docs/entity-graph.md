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

## Merge job

`scripts/merge-duplicate-companies.ts` folds each duplicate group into its best-populated row. Planning is pure (`lib/entities/merge.ts`), execution is `lib/entities/merge-apply.ts`, the schema is migration `127_company_merges.sql`. **Nothing is ever deleted**: a folded row stays in `companies` with `merged_into = <canonical id>` and `merged_at`, the resolver follows the pointer (`matchedOn: 'merged'`, confidence 1) and `GET /api/entities/company/:id` on an old id returns the canonical record, so every `companies.id` Terrain or Augur has stored keeps working.

### What one merge does

For a group of rows sharing a normalised name (spacing ignored):

1. **Canonical row** = highest `companyPopulationScore` (data quality + revenue + recent deals + classification + ids + aliases), ties broken by references already pointing at the row, then a non-registry row, then the oldest row.
2. **Alias union**: `name_variations` on the canonical becomes the union of every row's name and variations (canonical spelling first, exact-string dedupe).
3. **Hazard 1 strip**: any variation that is the *exact name of a separate canonical row* is dropped from the union and recorded (`Kite (Gilead)` loses "Gilead" and "Gilead Sciences"; `Alexion (AstraZeneca)` loses "AstraZeneca"; the row keeps its own stem "Alexion"). Rows outside any group get the same treatment as their own `alias_strip` audit row.
4. **Re-point** every column below from the merged id to the canonical id.
5. `merged_into` / `merged_at` on the surplus row; one `company_merges` audit row per surplus row with the alias union, the strips, `{table.column: rows}` re-pointed, the moved primary keys and any unique-index conflicts.

### Guard rails (never merged, listed under "Review" in the report)

| Guard | Rule | Example |
|---|---|---|
| ticker conflict | two rows in the group carry different tickers | `Merck` MRK vs `Merck Inc` MKGAF |
| cik conflict | two rows carry different `cik` / `sec_cik` (zero-padding ignored) | |
| subsidiary / division marker | rows' names differ by a parenthetical, a trailing division word (`oncology`, `respiratory`, `ophthalmology`, `consumer health`, `vaccines`, `japan`, …) or a known subsidiary next to its parent (`Genentech`/Roche, `Janssen`/J&J, `Alexion`/AstraZeneca, `Kite`/Gilead, …) | `Novartis Pharma AG (UK)` vs `Novartis Pharma AG UK` |
| marker review (information only) | a row whose stem is another canonical row's name is listed, not merged | `Pfizer Oncology` ↔ `Pfizer` |

A row that has a ticker next to one that has none merges normally (the canonical keeps the id).

### Tables that hold a `companies.id` (measured from `pg_constraint` / `pg_attribute`, Sep 25 2026)

Every column below is re-pointed. `unique with` names the other columns of a unique index that includes the company column: a row whose key already exists on the canonical id cannot move, stays on the merged id (which still exists) and is counted under `conflicts` in the audit row.

| table.column | FK | on delete | unique with |
|---|---|---|---|
| deals.licensor_id | yes | set null | — |
| deals.licensee_id | yes | set null | — |
| drug_owners.company_id | yes | cascade | drug_id, role, territory |
| drug_master.originator_company_id | yes | set null | — |
| clinical_assets.company_id | yes | set null | — |
| clinical_assets.partner_company_id | yes | set null | — |
| counterparty_premiums.company_id | yes | cascade | as_of_date |
| company_trials.company_id | yes | cascade | nct_id |
| company_financials.company_id | yes | cascade | fiscal_period_end, period_type |
| company_intent_signals.company_id | yes | cascade | signal_type, source_type, source_id |
| company_patents.company_id | yes | cascade | patent_id |
| licensing_signals.company_id | yes | set null | — |
| intent_score_snapshots.company_id | yes | cascade | modality, indication, snapshot_date |
| drug_revenues.company_id | yes | cascade | drug_name_normalized, fiscal_year, fiscal_period |
| trial_interventions.company_id | yes | set null | — |
| sponsor_aliases.company_id | yes | set null | — |
| competitive_intel.competitor_company_id | yes | set null | — |
| radar_deal_opportunities.acquirer_company_id | yes | cascade | asset_id |
| radar_deal_opportunities.asset_company_id | yes | set null | — |
| asset_catalysts.company_id | yes | set null | — |
| predictions.company_id | yes | set null | — |
| outcomes.licensee_id | yes | set null | — |
| outreach_emails.company_id | yes | set null | — |
| watchlist_items.company_id | yes | cascade | — |
| radar_score_snapshots.company_id | no | — | — (pk feature_version, as_of, asset_id) |
| portfolio_deal_pipelines.partner_company_id | no | — | — |
| press_releases.company_ids (`uuid[]`) | no | — | — (array_replace) |

Not company ids, checked and excluded: `registry_trials.mapped_company_trial_id` (→ `company_trials.id`), the `*_name` text columns, `partner_match_results.top_match_company` (text), `radar_deal_theses.likely_acquirers` (jsonb of names). The list lives in `COMPANY_REFERENCING_COLUMNS` (`lib/entities/merge.ts`); a new table that stores a `companies.id` must be added there.

### Dry run (default, read-only)

```
npx tsx scripts/merge-duplicate-companies.ts
```

Pages all `companies` rows, counts references for every group member in every column above (index-aligned pages; per-id HEAD counts when a chunk times out), plans, and writes:

- `tmp/company-merge-report.md` — summary table; references per table.column; top 20 groups by references; the review list (guard rails); marker review; the alias strips; deals whose party id points at a row that carries the party name only as a stripped alias while a row named exactly that exists (hazard 1 in the wild, 445 on Sep 25 — the job does not re-point those, it only stops them recurring; a person decides which row is right); every planned group; the SQL for the top group.
- `tmp/company-merge-plan.json` — the full plan (`plans[]` with canonical, merged rows, reasons, alias union, strips; `review[]`; `markerReview[]`; `singletonStrips[]`; `misroutedDeals[]`; `referencingColumns`).

The console prints the same summary. Both files are gitignored (`tmp/`).

### Apply (Issa only)

Apply migration 127 first (Supabase SQL editor or `supabase db push`); the script refuses to run when `company_merges` or `companies.merged_into` is missing. Then, from the repo root:

```
MERGE_APPLY=yes npx tsx scripts/merge-duplicate-companies.ts --apply --run-id merge-2026-09-26
```

Three guards must all be present: `--apply`, `--run-id <id>` (3–64 chars, becomes `company_merges.run_id`) and the environment variable `MERGE_APPLY=yes`. The apply re-plans from the live table (never from a stale JSON), applies the plans in reference-count order, then the singleton alias strips. Staged rollout: `--limit 20` (top 20 groups), `--only <key>` (one group by its compact key, e.g. `janssencilag`), `--skip-strips`. Re-running is idempotent: rows already carrying `merged_into` are skipped. A hard error stops the run; audit rows written so far stay and describe exactly what moved.

Deploy order: migration 127 can go in before the code (it is additive); the resolver tolerates either schema. After the migration is live, `merged_into` can be added to `COMPANY_COLS` so name-pool queries skip folded rows outright (today `pickBestCompany` only demotes them).

### Rollback

Everything is reversible because nothing is deleted and each audit row carries what changed:

```sql
-- one merge
SELECT canonical_id, merged_id, repointed, repointed_ids, conflicts, alias_union, aliases_stripped
FROM company_merges WHERE run_id = 'merge-2026-09-26' AND merged_id = '<id>';

UPDATE companies SET merged_into = NULL, merged_at = NULL WHERE id = '<merged_id>';
-- for each "table.column" in repointed_ids, move the listed primary keys back:
UPDATE deals SET licensor_id = '<merged_id>' WHERE id = ANY(ARRAY[...]::uuid[]);  -- etc.
-- restore the canonical's previous name_variations from the row's own name plus the union minus the merged row's names, or from a backup
```

`repointed_ids` is capped at 20,000 keys per column (`_truncated: true` flags it); for a larger column, rows to move back are those where `column = canonical_id` and the row's own company-name text matches the merged name. The whole run reverts with the same statements over `WHERE run_id = '…'`. Alias strips (`reason = 'alias_strip'`) revert by appending `aliases_stripped` back onto `name_variations`.

## Follow-ups

- **Merge job**: run the dry run, read the review list, apply migration 127, then apply in stages (top 20 by references first). After the apply, re-resolve the deals listed under "mis-routed" in the report and add `merged_into` to `COMPANY_COLS`.
- **Terrain**: replace `company_name` / `asset_name` text keys on indication competitive-density and pipeline rows with `company_id` / `asset_id` (`companies.id` / `drug_master.id`) filled through `/api/entities/resolve`; keep the raw strings as `*_raw`. Expose the demand-layer API keyed on those ids (Sequencing §4).
- **Augur**: portfolio companies and rounds store `companies.id`; exits that are licensing deals store `deals.id`. NAV marks vs later rounds join on the id, not the name.
- **Deal coverage**: only 312 of 2,072 deals pass the quality filter today (1,496 are rejected / flagged, 913 non-canonical), so deal resolution covers the verified core only; the outcome resolver (Workstream 1) should expect nulls for older or unverified deals until the backfill validator has been re-run.
- **Env**: set `ENTITY_API_KEY` in Vercel (production + preview) and share it with the Terrain and Augur deployments; rotate by replacing the value (no key table yet). Without it, only session-authenticated Solidus users can call the routes.
