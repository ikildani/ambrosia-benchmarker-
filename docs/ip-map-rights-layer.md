# IP Map — the rights layer (Workstream 6 of the outcomes program)

Decision (2026-09-25): IP Map is built as a layer that feeds Solidus, Augur and the Deal Intelligence Brief, keyed on the shared asset and company identifiers. It becomes a standalone product only if a buyer pays for it alone.

## What the rights layer answers

For any asset or company on the graph: when does exclusivity end, what is the freedom-to-operate risk, which competitor filings threaten the position, and which of those events reprice a deal.

## Sources (all primary, all citable)

- USPTO and EPO grants and applications (PatentsView is already ingested for `company_patents`), Orange Book and Purple Book listings and expiries, FDA exclusivity grants (orphan, pediatric, NCE), EMA data exclusivity, patent term extensions, PTAB and litigation dockets, licensing disclosures in SEC filings (already in `deals`).

## Outputs consumed by the other platforms

| Consumer | What it takes from the rights layer | The decision it changes |
|---|---|---|
| Solidus catalyst calendar | Expiry, PTE and litigation dates on the asset and on the buyer's own products | When to go to market; buyer urgency |
| Solidus buyer map | Buyer's loss-of-exclusivity calendar from filings, not from a hand-maintained `patent_cliffs` column | Who has the gap and when |
| Brief term-sheet page | Exclusivity and term-length precedent by patent runway | What to ask for on term and reversion |
| Augur fair value | Effective loss-of-exclusivity year per asset | Peak-sales duration in every mark |

## Loop

Predicted loss-of-exclusivity year vs actual generic or biosimilar entry; predicted FTO risk vs litigation filed. Both are public events, so the layer scores itself without client input.

## Build order

1. Orange Book, Purple Book and FDA exclusivity ingestion keyed to `drug_master.id` (replaces `indication_patent_cliffs`, which holds 15 rows).
2. Company-level LOE calendar computed from those records (replaces `companies.patent_cliffs`, populated for 83 of ~25,000 companies).
3. Litigation and PTAB dockets as catalyst events.
4. Expose through `/api/entities/{asset|company}/{id}/rights`.

## Definition of done

The buyer map's exclusivity calendar and the catalyst calendar in a brief are generated from filings for every buyer, not from a hand-filled column, and the layer publishes its own accuracy on loss-of-exclusivity predictions.
