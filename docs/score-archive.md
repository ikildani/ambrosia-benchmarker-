# Score archive — point-in-time record of every score

Decision (2026-09-27): every score and prediction any AlaricAI product produces is written once to `score_archive` (migration 139) and never changed. This is the record behind accuracy claims, the Alaric track record, and any future licensed score feed. A buyer of scores asks "what did the model say on this date, before the outcome was known?". This table answers that, and the answer cannot be edited afterwards.

## What makes it unchangeable

- UPDATE, DELETE and TRUNCATE raise an error (triggers) and are revoked from `anon`, `authenticated` and `service_role`.
- `recorded_at`, `inputs_sha256` (for stored inputs) and `row_sha256` are set by the database. Values sent by the caller are overwritten.
- Each finished UTC day is sealed into `score_archive_digests`. The digest is a sha256 over that day's row hashes, chained to the previous day, like a ledger. Sealing runs in the nightly outcome phase (02:xx UTC, inside the `deal-verification` cron, because vercel.json is at the 100-cron cap). Each sealed chain head is logged as `[ScoreArchive] sealed <day>: <n> rows, chain <sha256>`.
- `SELECT * FROM verify_score_archive();` recomputes every row and every day. An empty result means the archive is intact. It detects edited rows, rows edited and re-hashed, and deleted rows, even if the database owner disabled the triggers to make the change.
- The database owner could still rewrite the whole chain. For evidence that does not depend on this Supabase project, copy each day's `chain_sha256` somewhere outside it: a public git commit, an object-lock bucket, or an email to counsel.

## What is archived today (Solidus)

| score_type | Where | When |
|---|---|---|
| `ledger.<source>`, `ledger.<source>.<status>` | DB trigger on `predictions` | every ledger prediction, and every status change (resolved / expired / withdrawn) |
| `outcome.<status>` | DB trigger on `outcomes` | every outcome, and every review decision |
| `radar.licensing_intent` | `lib/radar/signal-detection.ts` `persistWave` | every asset scored (about 2,000 a day), with its drivers and a 12-month horizon |
| `radar.deal_thesis` | `lib/radar/deal-thesis.ts` | every thesis written: predicted terms and acquirers |
| `radar.deal_opportunity` | `lib/radar/deal-creator.ts` | every opportunity scored ≥ 25 |
| `radar.mandate_match` | `lib/radar/mandate-matcher.ts` | every new match (mandate id hashed) |
| `pharma_intent.score` | `/api/cron/intent-snapshots` | weekly buyer intent by company × modality × indication |
| `counterparty.premium` | `/api/cron/counterparty-calibration` | quarterly buyer premiums |
| `calculator.deal_terms` | `/api/calculations` | every saved calculation, signed in or not |
| `brief.call` | `/api/benchmark/generate` | every brief generation: recommendation, ask / floor / walk-away, ranked buyer fit |
| `partner_match.fit` | `/api/partners/match` | every buyer-fit ranking returned |
| `simulator.zopa`, `trade_space.structure` | `/api/simulator`, `/api/trade-space` | every run |
| `share.published`, `scenario.saved` | `/api/share`, `/api/scenarios` | every share link and saved scenario |
| `mcp.<tool>` | `/api/mcp` (all scoring tools) | every enterprise API call except the three lookup tools |

Not archived: lookups of historical data (comparable deals, peer benchmarks, market calendar, deal database queries), model training and backtest tables (already versioned), and internal lead scores.

## Confidential inputs

Rows can never be deleted, so nothing a client entered in confidence is stored in readable form. For user-originated scores (calculator, brief, simulator, trade-space, share, scenarios, MCP) and ledger rows from the calculator, brief or share, the row keeps:

- `inputs_sha256`: proves what the inputs were without storing them;
- coarse profile fields: therapeutic area, phase, modality, indication;
- the output (numbers and public buyer names only; no prose).

Licensor and asset names on confidential ledger rows are stored as sha256 hashes. Platform scores on public entities (Radar assets, buyer intent, premiums) keep their full inputs and names.

## Writing from Terrain, Augur, IP Map and the Alaric engine

`POST https://solidus.ambrosiaventures.co/api/score-archive` with header `x-api-key: $ENTITY_API_KEY`:

```json
{
  "entries": [{
    "product": "terrain",
    "scoreType": "terrain.demand_forecast",
    "modelVersion": "terrain-demand-2.1",
    "origin": "platform",
    "entityType": "indication",
    "entityId": "lung_nsclc",
    "entityLabel": "Lung Cancer (NSCLC)",
    "therapeuticArea": "oncology",
    "inputs": { "sources": ["GBD 2023", "SEER"], "asOf": "2026-09-01" },
    "output": { "prevalence": 540000, "peakShare": 0.12 },
    "dataAsOf": "2026-09-01",
    "horizonEnd": "2031-12-31"
  }]
}
```

- ≤ 500 entries per call. Response: `{ inserted, rejected, errors }`, with status 201 (all inserted), 207 (some inserted) or 422 (none inserted).
- `product`: `terrain | augur | ip_map | alaric` (or `solidus`). `origin`: `platform | user | api | client`. `entityType`: `asset | company | deal | indication | portfolio | profile | patent | prediction`.
- Use the shared entity-graph ids for `entityId` (`companies.id`, `drug_master.id`, `deals.id`; see docs/entity-graph.md) so scores join across products.
- Client data (Augur portfolio marks, a GP's inputs): send `"confidential": true`. Only the hash of `inputs` is stored and `entityLabel` is dropped. Alternatively send only `inputsSha256`.
- Set `horizonEnd` for anything that will be judged against an outcome (IP Map loss-of-exclusivity year, Augur next-round mark, Alaric deal likelihood), so accuracy can be scored later.
- `industry` defaults to `life_sciences`. Set it when a second vertical ships.

Suggested score types: Terrain `terrain.demand`, `terrain.competitive_density`. Augur `augur.fair_value`, `augur.nav_proposed`, `augur.nav_approved`. IP Map `ip_map.loe_year`, `ip_map.fto_risk`. Alaric `alaric.deal_likelihood`, `alaric.buyer_fit`, `alaric.value_range`.

## Checking it

- Migration guarantees: `scripts/score-archive/verify-migration.sh` applies the migration to a throwaway local Postgres and checks append-only behaviour, hashing, ledger copies, sealing and tamper detection.
- Writers: `__tests__/lib/score-archive.test.ts`.
- In production: `SELECT day, row_count, chain_sha256 FROM score_archive_digests ORDER BY day DESC LIMIT 7;` and `SELECT * FROM verify_score_archive(current_date - 30);`.
