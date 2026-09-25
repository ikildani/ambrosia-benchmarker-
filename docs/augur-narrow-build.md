# Augur — narrow build (Workstream 5 of the outcomes program)

Decision (2026-09-25): Augur ships four capabilities, each with a loop from day one. The eight-domain spec stays as the destination; nothing outside these four is built until each of them is scoring itself against outcomes.

## The four capabilities and their loops

| Capability | What the GP does differently | Loop that scores it | Money it measures |
|---|---|---|---|
| **Fair value engine** | Marks a private biotech position with a defended range (rNPV + comps from Solidus + milestone + option pricing), with provenance on every input | Every mark is scored against the next priced round, secondary, or exit; median error by stage published inside the product | Marks moved before an LP report; audit adjustments avoided |
| **NAV workflow** | Quarter-day queue: engine proposes → analyst reviews → GP approves; clinical events auto-adjust marks with approval | Proposed vs approved deltas are recorded; systematic bias by TA or analyst becomes visible | Days from quarter-end to LP-ready NAV |
| **Attribution** | For each portfolio company, what the fund's actions changed (deal terms, milestones, hires, follow-on) against a counterfactual peer set | Attributed value is re-scored at the next round/exit | Attributed value per partner, per fund, over time |
| **LP report** | AI-drafted, GP-edited, compliance-reviewed, distributed with read receipts; biotech sections (catalysts, PoS, comps) | Which sections LPs open and question; drafts vs final edits | Hours per quarter; LP questions answered before they are asked |

## What it consumes from the other platforms (through the shared entity graph)

- Solidus: comparable deals, buyer intent, the outcome ledger (a portfolio company's deal resolved → Augur mark re-scored automatically).
- Terrain: demand profiles by indication for peak-sales assumptions inside the fair value engine.
- IP Map (later): expiry and exclusivity catalysts that move marks.

Rule: Augur stores Solidus company and asset ids, never its own name strings.

## Data ingestion (kept from the spec, narrowed)

Document AI on board decks, financials, cap tables and term sheets with per-field confidence; portfolio-company portal for quarterly self-report pre-filled from extraction; Carta integration for cap tables. NAV-affecting fields require human confirmation.

## Institutional infrastructure that ships with the four (not later)

Provenance on every number, immutable audit trail, as-of snapshots, "why this mark" explainability. These are what make a GP trust a mark; without them the loop cannot be audited.

## Deferred until the four have loops

Capital deployment intelligence, market pulse NLP, fund-formation radar, LP aggregated dashboards, benchmarking tiers, custom dashboards, collaboration, scenario comparison.

## Definition of done

A GP marks a portfolio at quarter-end inside Augur, the engine's proposed marks and the GP's approved marks are both recorded, and when a portfolio company prices its next round the platform shows how far each mark was off, by whom, and why.
