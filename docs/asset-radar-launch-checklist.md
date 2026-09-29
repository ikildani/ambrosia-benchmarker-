# Search & Evaluation — launch checklist

Before launch the module is an **internal preview**: signed-in
`@ambrosiaventures.co` accounts (and any address in
`NEXT_PUBLIC_RADAR_PREVIEW_EMAILS`) see `/radar/*` and `/search-and-evaluation`
in production; everyone else gets a 404 and sees no marketing mentions.
All gating reads `RADAR_PUBLIC` in `lib/radar/launch.ts`.

## Flip to public

1. Vercel Production: `NEXT_PUBLIC_RADAR_ENABLED=true`, then redeploy (inlined at build).
2. That alone turns on: the Header link for all signed-in users, the bell's Radar
   alerts, the `/pro` block + FAQ, the Pricing bullet, the Cortellis rows,
   the landing page (indexable) and its sitemap entry.
3. Restore these static lines (llms.txt files cannot read env):

`public/llms.txt`:

```
- **Search & Evaluation asset universe**: 45,000+ unpartnered or partially partnered industry programs (preclinical to Phase 3) resolved from trial registries in 100 countries, each with a licensing-intent score shown against peers and predicted deal terms from cited comparables
```

`public/llms.txt`:

```
- https://solidus.ambrosiaventures.co/search-and-evaluation — Search & Evaluation: screen unpartnered clinical-stage assets by mandate, licensing-intent score, predicted terms, acquirer view
```

`public/llms-full.txt`:

```
### Search & Evaluation (asset screening module, included in Pro)
- 45,000+ unpartnered or partially partnered industry programs, preclinical to Phase 3, resolved from trial registries in 100 countries and from company filings (10-K / 20-F pipeline disclosures for preclinical programs)
- Licensing-intent score per asset, shown as a percentile within phase × therapeutic-area peers, with the evidence behind each factor and an out-of-sample backtest published at https://solidus.ambrosiaventures.co/radar/methodology
- Predicted deal terms per asset (upfront, total, royalty range) from cited, phase-matched comparable transactions
- Mandates (saved buyer criteria) with daily digests, watchlists, alert rules, saved views and an acquirer view ("I am company X: which programs fit my gaps")
- Landing page: https://solidus.ambrosiaventures.co/search-and-evaluation
```

`public/llms-full.txt`:

```
- 45,000+ screenable clinical-stage and preclinical programs across 100 countries (Search & Evaluation)
```

4. `app/radar/layout.tsx` still sets `robots: noindex` for the app pages; that stays (the landing page is the indexable surface).
5. Launch email: `npx tsx scripts/radar-launch-email.ts --wave day0` (dry run), then `--send`.
