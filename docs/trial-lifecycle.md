# Trial lifecycle: the standing conversion motion

The founder-led sequence run by hand for the September 2026 cohort is now the system. Every trial gets three short emails from Issa, keyed to the account's real expiry, at full price, with no automated extension and no discount. Nothing else emails a trial account during its window.

## The motion

| Track | Who | T1 | T2 | T3 |
|---|---|---|---|---|
| active | trial with at least one benchmark | 5 days before expiry: one exact fact about their indication, one interpretation sentence, deep link to their program, price once at the end | day of expiry: one line, pricing link | 3 days after: "everything you built is intact", price once |
| zero_calc | trial that never ran a benchmark | 5 days before: "let me build your first benchmark", reply with indication / stage / modality | day of | 3 days after |
| winback | reopened 7-day Pro window (`pro_engagement_type` starts with `winback`) | reopen day: fact, "I have reopened Pro for seven days, no card", deep link | 2 days before close | 3 days after |

Windows are calendar days around `user_profiles.pro_expires_at`, tolerant of a late cron: active and zero-calc T1 at +4..+6, T2 at 0..-1, T3 at -3..-5; win-back T1 at +5..+7, T2 at +1..+2, T3 at -3..-5. Later touches win, so a late run never sends T1 after expiry.

Excluded: paying subscribers (`subscription_status` active or past due), portfolio and report tiers, `internal_team`, `complimentary`, `advisory-guest`, and any account with `drip_suppressed_until` in the future (a one-off sequence run by hand owns that account).

## Timing and dedupe

`app/api/cron/trial-lifecycle` runs daily at 13:00 UTC (09:00 ET) and sends at most 60 emails per run. Each send writes an `events` row (`trial_seq_t1`, `trial_seq_t2`, `trial_seq_t3`) with the track, subject, CTA and offer flags; a touch is never sent twice. The email goes from `Issa Kildani <ikildani@ambrosiaventures.co>` with reply-to Issa, as plain text with a minimal HTML twin.

## The one exact fact

For each account the cron looks up the most recent verified comp in the same therapeutic area and indication, through the same quality filter the comp engine uses (not synthetic, canonical, not flagged or rejected, verified first). A comp with a disclosed upfront becomes the fact. If none, the fact is the count of disclosed deals in the indication. If that is zero, the email says so plainly. No number in a lifecycle email comes from anywhere else.

## Copy rules

Enforced by `lintEmail` in `lib/lifecycle/trial-sequence.ts`; the cron holds any email that fails and reports it in the digest.

1. Lead with one exact fact. No "probably", "usually", "in my experience".
2. Usage informs the email and never appears as a count. "The NSCLC scenarios you ran", never "eight".
3. One CTA per email, deep-linked to the program (`/calculator?therapeuticArea=&modality=`). The pricing page appears only in T2 and T3.
4. Price appears once, late, never in the subject.
5. Subject is the insight, four to nine words, lowercase-natural.
6. Plain text from Issa. No template, no discount, no promo code, no "extend your trial".
7. No methodology language: engine, backtest, calibration, corpus, accuracy band, hit rate.

## Offers (flags, default OFF)

Set in the Vercel environment when Issa confirms the dates.

- `TRIAL_OFFER_TERRAIN=1` adds the close: anyone on Pro by their trial end gets 60 days of Terrain free when it launches in October. Appears in T1, T2 and T3, never in the subject.
- `TRIAL_OFFER_SEARCH_MODULE=1` adds one sentence about the Search and Evaluation module releasing this month, only for accounts whose last benchmark was an acquisition or co-development (buyers). Sellers never see it.

## What was retired, and why

- `smart-trial-extend` no longer runs. It extended any active trial by 7 days two days before expiry and emailed "your trial has been extended", the day after Issa said it ends Sunday. Extensions are granted by hand on request. The route stays as a logged no-op.
- `post-trial-drip` lost its day-12 "20% off" email and now skips any account the sequence has emailed. Its day-1 and day-5 emails remain only for accounts that were never in the sequence.
- `calculation-convert` skips accounts inside a lifecycle window (T-5 to T+8).
- `onboarding-drip` (day 0 / 3 / 7 for new free accounts) is unchanged.

## How Issa reviews sends

Every run that sends or holds anything emails Issa a digest the same morning: each recipient, track, touch and subject; anything held by lint with the reason; any send error; and the state of the two offer flags. Replies land in Issa's inbox because the email is from Issa. To stop the sequence for one account, set `drip_suppressed_until` on the profile. To stop it for everyone, remove the cron from `vercel.json`.

## Where the code is

- `lib/lifecycle/trial-sequence.ts`: pure copy, scheduling and lint. Tests in `__tests__/lib/trial-sequence.test.ts`.
- `app/api/cron/trial-lifecycle/route.ts`: selection, comps, send, events, digest. Tests in `__tests__/api/cron-trial-lifecycle.test.ts`.
- `lib/email/client.ts`: `sendEmail` accepts `text` for a plain-text alternative.
