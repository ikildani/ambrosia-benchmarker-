'use client';

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import type { AssetBrief } from './types';
import { Pill, KV, ExternalLink, scoreTone } from './ui';
import { label, fmtAge, fmtDate, territoryLabel, signedPts } from './format';

const OWNER_TYPE_LABEL: Record<string, string> = {
  industry: 'Industry', academic: 'Academic', government: 'Government', hospital: 'Hospital',
  network: 'Network', cro: 'CRO', other: 'Other', unknown: 'Unknown owner type',
};

function evidenceHref(e: AssetBrief['partnership']['evidence'][number]): string | null {
  if (e.url) return e.url;
  if (e.type === 'trial_collaborator' && /^NCT\d{8}$/.test(e.id)) return `https://clinicaltrials.gov/study/${e.id}`;
  return null;
}

export function AssetHeader({ brief }: { brief: AssetBrief }) {
  const { asset, owner, drug, partnership, score, trend, freshness } = brief;
  const aliases = (asset.asset_aliases || []).filter(a => a && a !== asset.asset_name).slice(0, 4);
  const tone = scoreTone(score.score);
  const designations = asset.regulatory_designations || [];

  return (
    <header className="border-b border-neutral-200 pb-5 dark:border-neutral-800">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Asset Radar · Deal brief</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-3xl">{asset.asset_name}</h1>
          {aliases.length > 0 && (
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Also known as {aliases.join(', ')}</p>
          )}
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">{owner.company_name}</span>
            {owner.owner_type && <span> · {OWNER_TYPE_LABEL[owner.owner_type] ?? owner.owner_type}</span>}
            {owner.country && <span> · {label(owner.country)}{owner.region ? ` (${label(owner.region)})` : ''}</span>}
            {owner.website_url && (
              <ExternalLink href={owner.website_url} className="ml-2 inline-flex items-center gap-0.5 text-xs">
                Site <ArrowTopRightOnSquareIcon className="h-3 w-3" aria-hidden="true" />
              </ExternalLink>
            )}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Asset classification">
            <Pill tone="amber">{label(asset.phase)}</Pill>
            <Pill>{label(asset.modality)}</Pill>
            <Pill>{label(asset.therapeutic_area)}</Pill>
            {(asset.indication_specific || asset.indication_category) && (
              <Pill>{asset.indication_specific || (asset.indication_category || '').replace(/_/g, ' ')}</Pill>
            )}
            {asset.trial_status && <Pill>{asset.trial_status.replace(/_/g, ' ')}</Pill>}
            {designations.map(d => <Pill key={d} tone="sky">{d.replace(/_/g, ' ')}</Pill>)}
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-6 lg:text-right">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Licensing intent</p>
            <p className={`mt-0.5 text-4xl font-semibold tabular-nums ${tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-900 dark:text-neutral-100'}`} aria-label={`Licensing intent score ${score.score} out of 100`}>
              {score.score}<span className="text-base font-normal text-neutral-400 dark:text-neutral-500">/100</span>
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              confidence {score.confidence} · 30d {signedPts(trend.delta_30d, 0)} · 90d {signedPts(trend.delta_90d, 0)}
            </p>
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        <KV label="Target / mechanism">
          {asset.target || asset.mechanism || asset.moa_short
            ? <>{asset.target}{asset.target && (asset.mechanism || asset.moa_short) ? ' · ' : ''}{asset.mechanism || asset.moa_short}{asset.target_class ? <span className="block text-xs text-neutral-500 dark:text-neutral-400">{asset.target_class}</span> : null}</>
            : <span className="text-neutral-500 dark:text-neutral-400">Not extracted</span>}
        </KV>
        <KV label="Partnership">
          <Pill tone={partnership.status === 'unpartnered' ? 'emerald' : partnership.status === 'partnered' ? 'rose' : 'amber'}>{label(partnership.status)}</Pill>
          {partnership.partner_name && <span className="ml-1.5">{partnership.partner_name}</span>}
          <span className="block text-xs text-neutral-500 dark:text-neutral-400">
            {Math.round(partnership.confidence)}% confidence
            {partnership.evidence.length > 0 && (
              <> · {partnership.evidence.slice(0, 3).map((e, i) => {
                const href = evidenceHref(e);
                const text = e.type === 'deal' ? 'deal' : e.type === 'trial_collaborator' ? e.id : 'press';
                return <span key={`${e.type}-${e.id}`}>{i > 0 ? ', ' : ''}{href ? <ExternalLink href={href}>{text}</ExternalLink> : text}</span>;
              })}</>
            )}
          </span>
        </KV>
        <KV label="Rights available">
          {partnership.rights_available.length > 0
            ? partnership.rights_available.map(territoryLabel).join(', ')
            : <span className="text-neutral-500 dark:text-neutral-400">{partnership.status === 'unpartnered' ? 'All territories (no partner on record)' : 'Not established'}</span>}
        </KV>
        <KV label="Drug identity">
          {drug ? (
            <>
              <span>{drug.inn || drug.preferred_name}</span>
              <span className="block font-mono text-xs text-neutral-500 dark:text-neutral-400">
                {drug.unii && <ExternalLink href={`https://gsrs.ncats.nih.gov/ginas/app/beta/substances/${drug.unii}`}>UNII {drug.unii}</ExternalLink>}
                {drug.unii && drug.chembl_id ? ' · ' : ''}
                {drug.chembl_id && <ExternalLink href={`https://www.ebi.ac.uk/chembl/explore/compound/${drug.chembl_id}`}>{drug.chembl_id}</ExternalLink>}
              </span>
            </>
          ) : <span className="text-neutral-500 dark:text-neutral-400">{asset.drug_resolution_status === 'ambiguous' ? 'Ambiguous match' : 'Unresolved'}</span>}
        </KV>
        <KV label="Program" mono>
          {asset.trial_count ?? 0} trials · {(asset.enrollment_total ?? 0).toLocaleString('en-US')} enrolled
          {asset.lead_nct_id && <span className="block text-xs"><ExternalLink href={`https://clinicaltrials.gov/study/${asset.lead_nct_id}`}>{asset.lead_nct_id}</ExternalLink></span>}
        </KV>
        <KV label="Freshness">
          <span className="block text-xs" title={`Registry ${fmtDate(freshness.last_update_date)} · scored ${fmtDate(freshness.last_scored_at)} · enriched ${fmtDate(freshness.last_enriched_at)}`}>
            Registry {fmtAge(freshness.last_update_date)}
          </span>
          <span className="block text-xs">Scored {fmtAge(freshness.last_scored_at)}</span>
          <span className="block text-xs">Enriched {fmtAge(freshness.last_enriched_at)}</span>
        </KV>
      </dl>
    </header>
  );
}
