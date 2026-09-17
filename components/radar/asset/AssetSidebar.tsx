'use client';

import type { AssetBrief, BriefViewer } from './types';
import { fmtDateTime, fmtAge } from './format';
import { WatchlistToggle } from '@/components/radar/team/WatchlistToggle';
import { AlertSettings } from './AlertSettings';
import { ExportMenu } from './ExportMenu';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-neutral-200 py-4 first:pt-0 last:border-b-0 dark:border-neutral-800" aria-label={title}>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{title}</h2>
      {children}
    </section>
  );
}

/** Right column on desktop; bottom sheet body on mobile. */
export function AssetSidebar({ brief, viewer }: { brief: AssetBrief; viewer: BriefViewer }) {
  const f = brief.freshness;
  return (
    <div>
      <Block title="Watchlist">
        <WatchlistToggle assetId={brief.asset.id} />
      </Block>
      <Block title="Alerts">
        <AlertSettings assetId={brief.asset.id} />
      </Block>
      <Block title="Export and share">
        <ExportMenu assetId={brief.asset.id} assetName={brief.asset.asset_name} />
      </Block>
      <Block title="Data freshness">
        <dl className="space-y-1 text-xs">
          {([
            ['Registry update', f.last_update_date],
            ['Scored', f.last_scored_at],
            ['Enriched', f.last_enriched_at],
            ['Partnership checked', f.partnership_checked_at],
            ['Thesis generated', f.thesis_generated_at],
            ['Drug resolved', f.drug_resolved_at],
          ] as const).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-neutral-500 dark:text-neutral-400">{k}</dt>
              <dd className="font-mono tabular-nums text-neutral-800 dark:text-neutral-200" title={fmtDateTime(v)}>{fmtAge(v)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
          Brief generated {fmtDateTime(brief.generated_at)} · model {brief.score.model_version}
          {viewer.team_name && <> · team {viewer.team_name}</>}
        </p>
      </Block>
    </div>
  );
}
