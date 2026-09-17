# Deal ingestion diagnosis, 15 to 17 September 2026

Why every live deal source inserted nothing for two weeks while the log showed green, measured stage by stage, with the fix per source and who owns it.

## The headline

The log recorded `status = 'completed'` on 400+ runs across six sources between 26 August and 17 September. In that window the sources together inserted **one** cited deal row (a 10-K batch of 17 on 6 September was a manual run). The log had three fields, fetched / processed / inserted, and every pipeline printed the reasons for its drops to the console, where nobody reads them. So a source that fetched 32,000 items and inserted zero looked identical to a healthy one.

The fix that applies to every source is the same: count every stage of the funnel, persist the counts to `data_ingestion_log.parameters.funnel`, and never log a zero-fetch from a productive source as `completed`. Both are in this branch (`lib/ingestion/funnel.ts`, `lib/cron-utils.ts`).

## Per-source findings

The 21-day totals come from `data_ingestion_log` by `started_at`. The per-stage counts come from local dry runs on 17 September against the live sources, with nothing written.

| Source | Runs | Fetched | Inserted | Where items die | Root cause | Owner |
|---|---|---|---|---|---|---|
| `press_releases` (15:00 daily + 2h persist-only) | 132 + 122 | 32,513 + 31,592 | 0 | 234 fetched → 209 keyword-filtered → 25 to extractor → 17 not a deal, **7 confidence gate**, 3 content unavailable | Gate at 85 drops real deals extracted from article text at 60 to 84: Orbis → Novo Nordisk (60), Chimagen → GSK (72), Sironax → Novartis (65) on one afternoon. 2h persist-only run sends 0 to extraction by design. | This branch |
| `edgar_realtime` (every 2h) | 125 | 4,181 | 0 | 331 fetched → **318 keyword-filtered** → 12 to extractor → 12 not a deal | Route searches `q="8-K"` and gets every 8-K in America; keyword filter runs on the first document of each filing (the cover page); the extraction cap is spent on Cemtrex, PEDEVCO, La Rosa Holdings. 1 run hit SEC 500. | This branch |
| `cron_deal_backfill` (4x daily) | 42 | 21 | 0 | 19 of 42 runs failed at search | EFTS returns HTTP 500 when `from` runs past the last hit; cursor never advanced, so the same dead page was retried four times a day. Window was 30 days. | This branch |
| `sec_edgar` (03:00 daily inside `deals-update`) | 10 | 0 | 0 | Search | EFTS hit shape changed: parser read `_source.cik` and `_source.accession_number`, which no longer exist (now `_source.ciks[]` and `_source.adsh`, filename in `_id`). Threw on the first hit of every search. | This branch (`parseEftsHit` in `lib/ingestion/sec-edgar.ts`) |
| `historical_backfill` (every 6h) | 0 logged | 0 | 0 | Never reached the log | Perplexity-driven; credits were out until 9 September and it does not log a run it cannot start. Not a primary source; left as-is. | Nobody until sources above are green |
| `perplexity_discovery` | 62 | 286 | 0 | Rotation cursor stuck, 230 failures on Anthropic credit and abort | Fixed on `fix/ingestion-sep15` (merged 16 September). | Other terminal, done |
| `deal_verification` (every 2h) | 107 | 3,932 | 814 verdicts | 2,649 failures | Anthropic credit-balance 400s and Perplexity 401s until 9 September. Recovered. | Other terminal, monitoring |

Two things the table does not show. First, the SEC search endpoint itself is healthy: 399 8-Ks for 16 September, 493 "license agreement" 8-Ks for Q1 2019. Second, the pharma-scoped query this branch introduces (`"license agreement" (pharmaceutical OR biotechnology OR therapeutic) (upfront OR milestone OR royalt*)`) returns 264 filings for Q1 2019 and 19 for the last seven days, and its hits are the EX-99.1 press-release exhibits, which is the document the extractor was built for.

## Fixes in this branch

1. **Funnel instrumentation everywhere.** `FunnelCounter` records fetched, keyword_filtered, already_in_table, content_unavailable, content_too_short, not_a_deal, confidence_gate (with the score band), missing_parties, validator_rejected (with the code), duplicate, insert outcome and time_budget. Serialised into `parameters.funnel` on every run.
2. **Zero-fetch is never `completed`.** `logCronRun` marks a run `partial` with an explicit note when a source in `SOURCES_EXPECTING_RECORDS` fetches nothing. `edgar_realtime` passes `expectRecords=false` before 09:00 ET and on weekends so an empty SEC morning is not an alert.
3. **One door into `deals`.** `insertCitedDeal` refuses any row without `source_url`, `press_release_url` or `source_filing_id`, normalises `source_type`, stamps extraction model and timestamp. Every pipeline on this branch inserts through it.
4. **press_releases.** Gate lowered to 75 for article-backed extractions; 60 to 74 are inserted as `verification_status='pending'` with the score in the notes so the verifier decides, instead of being dropped. Reuters feed removed (dead). Publishers that 403 the research User-Agent get one retry with a browser UA.
5. **edgar_realtime.** Rewritten as `lib/ingestion/edgar-realtime.ts`: searches the pharma deal terms directly in EFTS rather than every 8-K, follows the hit to the exhibit it matched, pages the full day, runs dry locally.
6. **cron_deal_backfill.** Advances the cursor on SEC 500 and on the last page; window widened to 90 days; inserts through the shared door.
7. **sec_edgar.** `parseEftsHit` handles the current hit shape and logs unparseable hits instead of throwing.
8. **Historical corpus.** `edgar-fts-backfill` walks quarter × term from 2017 with a persisted cursor (see `docs/` section below).
9. **HKEX.** Adapter for the announcements title search (China biotech discloses licensing there; 3SBio/Pfizer and Lepu/MRG007 are examples). Note: the servlet answers `"result":"null"` after a burst of requests from one client for a period; the adapter throttles to one request per 3 seconds and backs off for an hour on an empty result that follows a non-empty one.
10. **Inflow alert and coverage report.** Daily Slack alert when 24h cited inflow is 0 or under the 7-day floor; weekly coverage by year.

## Handed off

- `perplexity_discovery`, `openfda`, `cron-health-monitor`, `smart-trial-extend`: other terminal, merged.
- Regulatory approvals: never written to `deals` (openfda change on main). If approvals are needed they get their own table.
- `deal_verification` failures: credits, recovered 9 September; the verifier's own funnel is a follow-up.
