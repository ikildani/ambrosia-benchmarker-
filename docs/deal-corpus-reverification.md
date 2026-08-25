# Deal corpus re-verification (R79g)

## Why this is not a citation backfill

The corpus holds 1,620 rows. 520 carry `verification_status = 'verified'`, of which
only 48 cite a source. The obvious reading — "the citations were never recorded" —
is wrong.

Four uncited verified rows were checked against primary sources. Results:

| Row | Outcome |
|---|---|
| Hengrui → GSK, $500M | Real deal, **mistagged**. Lead asset HRS-9821 is a PDE3/4 inhibitor for **COPD**, not oncology. Announced 2025-07-28, stored as 2025-07-01. |
| LaNova → Merck, $588M | Real deal, correct terms. Territory wrong (**global**, stored ex-China); asset was the slug `solid_tumors`, actually **LM-299**. |
| Ascentage → Takeda, $100M | Real deal. An **option**, not a licence, over **olverembatinib in CML** — haematology, so not a solid-tumour comparable. Royalties 12–19% were unrecorded. |
| Innovent → Sanofi, $300M | **No supporting source found.** The public record contradicts it entirely: the real Sanofi–Innovent transaction is 2022-08-04 and runs the other way (Sanofi out-licenses tusamitamab ravtansine to Innovent for China against up to €80M in milestones), alongside a separate ~€300M Sanofi equity investment. The stored $300M "upfront" appears to be that equity figure re-cast with the counterparties reversed. **Demoted to rejected.** |

Four for four carried material defects. The missing citation was concealing the
defect, not merely omitting a reference.

**Implication:** a row that cannot be tied to a primary source must lose its
verified status, not silently acquire a URL. Any process that only attaches
citations to existing rows will launder bad data into citable-looking data.

Sample size is four. The defect rate is not yet an estimate — but it is enough to
say the remaining 404 rows cannot be trusted until checked.

## Procedure

For each row, in `provenance_tier = 'B' AND is_canonical` order by deal value:

1. Locate the primary source — company press release, SEC filing, or regulator
   notice. Trade press is acceptable corroboration but not a primary citation.
2. Reconcile **every** stored field against it: counterparty direction, announced
   date, upfront, milestones, total, royalty band, territory, phase at signing,
   therapeutic area, deal structure (licence vs option vs acquisition).
3. Then either:
   - **Correct and cite.** Update the wrong fields, set `source_url` and
     `source_type`, and record what was checked in `verification_notes`.
   - **Demote.** If no primary source supports the row, set
     `verification_status = 'rejected'`, `verified = false`, and record what was
     searched and what the public record says instead. Do not delete: the row is
     evidence about which ingestion path produced it.

Every `verification_notes` entry is prefixed `R79g <date>:` so the batch is
queryable later.

## Writing the updates

Resolve targets by `licensor_name` / `licensee_name` / `announced_date`, and carry
a guard on every statement:

```sql
UPDATE deals SET ...
WHERE licensor_name ILIKE 'LaNova Medicines' AND licensee_name ILIKE 'Merck'
  AND announced_date = '2024-12-04';
```

Never address a row by a bare `id` copied from a query result. Migration 085's
first form did exactly that with ids taken from the wrong result set and
overwrote an unrelated row (Myovant / Pfizer, restored in 085b). Two further
misdirected statements were no-ops *only* because they carried `licensor_name`
guards. A guard makes a wrong identifier fail closed.

## Guardrail

`trg_deals_require_citation` (084b) blocks any new row entering the verified state
without a citation, and blocks stripping a citation from a verified row.
Pre-existing uncited rows pass through untouched so the maintenance path keeps
working while the queue is drained.

Once the queue is empty, tighten it by removing the grandfather branch in
`deals_require_citation_when_verified()`.

## Queue

```sql
SELECT id, licensor_name, licensee_name, asset_name, announced_date,
       upfront_usd/1e6 AS up_m, total_deal_value_usd/1e6 AS tot_m
FROM deals
WHERE provenance_tier = 'B' AND is_canonical
  AND upfront_usd IS NOT NULL AND total_deal_value_usd IS NOT NULL
ORDER BY total_deal_value_usd DESC;
```

404 rows remaining. Run `scripts/audit-deal-quality.sql` to track progress, and
`SELECT recompute_deal_dedupe();` after each batch.

## Known issues surfaced, not yet addressed

- **Announced dates corrupted on re-ingestion.** Ascentage/Takeda (a June 2024
  deal) also exists as three rows dated April, May and May 2026. 3SBio/Pfizer
  (May 2025) appears dated July 2026. The ingestion path appears to stamp the
  ingestion date onto `announced_date`. This silently ages old deals forward and
  breaks any recency filter.
- **`therapeutic_area` bucket labels.** `_option_deals`, `_codev_deals` and
  `_mega_deals` are stored where a therapeutic area belongs, so those rows fall
  out of area-filtered comparable sets.
- **Myovant / Pfizer terms.** $11.6B for a Pfizer acquisition of Myovant conflicts
  with the public record. Flagged pending in 085b.
