'use client';

/**
 * Mandate form: name, therapeutic areas, modalities, phase range, region or
 * country, partnership status, minimum intent score, notifications. Shows a
 * live match count (debounced count-only feed call) while editing. Used by
 * the first-run panel, "Save as mandate", and mandate editing.
 *
 * Owner type is offered because BD teams ask for it, but the mandate table
 * has no column for it, so it is applied to the current view only and the
 * form says so.
 */

import { useMemo, useState, type FormEvent } from 'react';
import {
  RADAR_TA_OPTIONS,
  RADAR_MODALITY_OPTIONS,
  RADAR_PHASE_OPTIONS,
  RADAR_PARTNERSHIP_OPTIONS,
  RADAR_REGION_OPTIONS,
  RADAR_COUNTRY_OPTIONS,
  radarLabel,
} from '@/lib/radar/vocab';
import { EMPTY_FILTERS, RADAR_OWNER_TYPE_OPTIONS, type RadarFilterState } from '@/lib/radar/client/filter-schema';
import type { RadarMandate } from '@/lib/radar/client/api-types';
import { useMatchCount } from '@/lib/radar/client/hooks';
import { filtersToMandateFields, mandateToFilters, unsavedFilterKeys, type DigestFrequency, type MandateFields } from '@/lib/radar/client/mandate';
import { FACET_TITLES, fmtEstimate } from '@/lib/radar/client/format';
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS_RING, Pill, SectionLabel, Spinner, cn } from './ui';

interface Props {
  /** Starting filters (from the current view, or the mandate being edited). */
  initial?: RadarFilterState;
  mandate?: RadarMandate | null;
  submitLabel?: string;
  saving?: boolean;
  error?: string | null;
  onSubmit: (fields: MandateFields, filters: RadarFilterState) => Promise<void> | void;
  onCancel?: () => void;
  /** Called when the form's filter selection changes, so the host can preview it. */
  onPreview?: (filters: RadarFilterState) => void;
}

const COUNTRY_PRIMARY = RADAR_COUNTRY_OPTIONS.slice(0, 12);
const COUNTRY_MORE = RADAR_COUNTRY_OPTIONS.slice(12);

export function MandateForm({ initial, mandate, submitLabel = 'Save mandate', saving, error, onSubmit, onCancel, onPreview }: Props) {
  const start = useMemo<RadarFilterState>(() => {
    if (mandate) return mandateToFilters(mandate);
    return initial ?? { ...EMPTY_FILTERS, partnership: ['unpartnered', 'partially_partnered'] };
  }, [initial, mandate]);

  const [name, setName] = useState(mandate?.name ?? '');
  const [filters, setFilters] = useState<RadarFilterState>(start);
  const [notifyEmail, setNotifyEmail] = useState(mandate?.notify_email ?? false);
  const [notifyInApp, setNotifyInApp] = useState(mandate?.notify_in_app ?? true);
  const [digest, setDigest] = useState<DigestFrequency>(mandate?.digest_frequency ?? 'daily');
  const [showMoreCountries, setShowMoreCountries] = useState(filters.country.some(c => COUNTRY_MORE.some(o => o.value === c)));
  const [nameError, setNameError] = useState<string | null>(null);

  const { count, status: countStatus } = useMatchCount(filters, true);
  const unsaved = unsavedFilterKeys(filters);

  const commit = (next: RadarFilterState) => {
    setFilters(next);
    onPreview?.(next);
  };
  const update = (patch: Partial<RadarFilterState>) => commit({ ...filters, ...patch });
  const toggle = (key: 'ta' | 'modality' | 'partnership' | 'region' | 'country' | 'owner_type', value: string) => {
    const cur = filters[key];
    const next: RadarFilterState = { ...filters };
    next[key] = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
    commit(next);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give the mandate a name');
      return;
    }
    setNameError(null);
    const fields = filtersToMandateFields(filters, {
      name: trimmed,
      notify_email: notifyEmail,
      notify_in_app: notifyInApp,
      digest_frequency: digest,
      description: mandate?.description ?? null,
    });
    await onSubmit(fields, filters);
  };

  return (
    <form onSubmit={submit} className="space-y-5" aria-describedby="mandate-live-count">
      <div>
        <label htmlFor="mandate-name" className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
          Name
        </label>
        <input
          id="mandate-name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Oncology ADCs, Phase 2 to 3, ex-China"
          maxLength={120}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? 'mandate-name-error' : undefined}
          className={cn(
            'mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-500 dark:bg-neutral-950 dark:text-neutral-100',
            nameError ? 'border-amber-600' : 'border-neutral-300 dark:border-neutral-700',
            FOCUS_RING,
          )}
        />
        {nameError && (
          <p id="mandate-name-error" role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            {nameError}
          </p>
        )}
      </div>

      <Group title="Therapeutic areas" hint="Leave empty for any">
        {RADAR_TA_OPTIONS.map(o => (
          <Pill key={o.value} active={filters.ta.includes(o.value)} onClick={() => toggle('ta', o.value)} title={o.longLabel ?? o.label}>
            {o.longLabel ?? o.label}
          </Pill>
        ))}
      </Group>

      <Group title="Modalities" hint="Leave empty for any">
        {RADAR_MODALITY_OPTIONS.map(o => (
          <Pill key={o.value} active={filters.modality.includes(o.value)} onClick={() => toggle('modality', o.value)} title={o.longLabel ?? o.label}>
            {o.longLabel ?? o.label}
          </Pill>
        ))}
      </Group>

      <div className="grid gap-4 sm:grid-cols-2">
        <Group title="Earliest phase">
          {RADAR_PHASE_OPTIONS.map(o => (
            <Pill key={o.value} size="sm" active={filters.phase_min === o.value} onClick={() => update({ phase_min: filters.phase_min === o.value ? null : o.value })} title={o.longLabel}>
              {o.label}
            </Pill>
          ))}
        </Group>
        <Group title="Latest phase">
          {RADAR_PHASE_OPTIONS.map(o => (
            <Pill key={o.value} size="sm" active={filters.phase_max === o.value} onClick={() => update({ phase_max: filters.phase_max === o.value ? null : o.value })} title={o.longLabel}>
              {o.label}
            </Pill>
          ))}
        </Group>
      </div>

      <Group title="Region" hint="Originator headquarters">
        {RADAR_REGION_OPTIONS.map(o => (
          <Pill key={o.value} active={filters.region.includes(o.value)} onClick={() => toggle('region', o.value)}>
            {o.label}
          </Pill>
        ))}
      </Group>

      <Group title="Country" hint="Narrower than region; both apply">
        {COUNTRY_PRIMARY.map(o => (
          <Pill key={o.value} size="sm" active={filters.country.includes(o.value)} onClick={() => toggle('country', o.value)} title={o.label}>
            {o.value} · {o.label}
          </Pill>
        ))}
        {showMoreCountries ? (
          COUNTRY_MORE.map(o => (
            <Pill key={o.value} size="sm" active={filters.country.includes(o.value)} onClick={() => toggle('country', o.value)} title={o.label}>
              {o.value} · {o.label}
            </Pill>
          ))
        ) : (
          <button type="button" onClick={() => setShowMoreCountries(true)} className={cn('text-xs font-medium text-teal-700 hover:underline dark:text-teal-300 rounded', FOCUS_RING)}>
            {COUNTRY_MORE.length} more countries
          </button>
        )}
      </Group>

      <Group title="Partnership status">
        {RADAR_PARTNERSHIP_OPTIONS.map(o => (
          <Pill key={o.value} active={filters.partnership.includes(o.value)} onClick={() => toggle('partnership', o.value)}>
            {o.longLabel ?? o.label}
          </Pill>
        ))}
      </Group>

      <Group title="Owner type" hint="Applies to this view; not stored with the mandate yet">
        {RADAR_OWNER_TYPE_OPTIONS.filter(o => o.value !== 'network' && o.value !== 'other').map(o => (
          <Pill key={o.value} active={filters.owner_type.includes(o.value)} onClick={() => toggle('owner_type', o.value)}>
            {o.label}
          </Pill>
        ))}
      </Group>

      <Group title="Minimum licensing intent score">
        <Pill active={filters.min_score === null} onClick={() => update({ min_score: null })}>
          Any
        </Pill>
        {[20, 40, 60, 80].map(s => (
          <Pill key={s} active={filters.min_score === s} onClick={() => update({ min_score: filters.min_score === s ? null : s })}>
            {s}+
          </Pill>
        ))}
      </Group>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Notifications</legend>
        <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-800 dark:text-neutral-200">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={notifyInApp} onChange={e => setNotifyInApp(e.target.checked)} className={cn('h-4 w-4 rounded border-neutral-400 text-teal-600 dark:border-neutral-600 dark:bg-neutral-900', FOCUS_RING)} />
            In-app
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={notifyEmail} onChange={e => setNotifyEmail(e.target.checked)} className={cn('h-4 w-4 rounded border-neutral-400 text-teal-600 dark:border-neutral-600 dark:bg-neutral-900', FOCUS_RING)} />
            Email digest
          </label>
          <div className="flex items-center gap-1" role="group" aria-label="Digest frequency">
            {(['realtime', 'daily', 'weekly'] as DigestFrequency[]).map(f => (
              <Pill key={f} size="sm" active={digest === f} onClick={() => setDigest(f)}>
                {f === 'realtime' ? 'As it happens' : f === 'daily' ? 'Daily' : 'Weekly'}
              </Pill>
            ))}
          </div>
        </div>
      </fieldset>

      {unsaved.length > 0 && (
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Not saved with the mandate: {unsaved.map(k => (k === 'q' ? 'search text' : k === 'phase' ? 'individual phase picks (kept as a range)' : FACET_TITLES[k as keyof typeof FACET_TITLES].toLowerCase())).join(', ')}.
        </p>
      )}

      <div className="flex flex-col-reverse items-stretch gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
        <p id="mandate-live-count" className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300" aria-live="polite">
          {countStatus === 'loading' && <Spinner />}
          {count === null ? (
            countStatus === 'error' ? 'Could not count matches' : 'Counting matches'
          ) : (
            <>
              <span className="font-mono font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{fmtEstimate(count)}</span>
              <span>{count === 1 ? 'asset matches' : 'assets match'} today</span>
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className={BTN_SECONDARY} disabled={saving}>
              Cancel
            </button>
          )}
          <button type="submit" className={BTN_PRIMARY} disabled={saving}>
            {saving && <Spinner className="border-white/40 border-t-white" />}
            {submitLabel}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">
          {error}
        </p>
      )}
      <p className="sr-only">
        Selected: {filters.ta.map(v => radarLabel(v)).join(', ') || 'any area'}; {filters.modality.map(v => radarLabel(v)).join(', ') || 'any modality'}.
      </p>
    </form>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1.5 flex items-baseline gap-2">
        <SectionLabel>{title}</SectionLabel>
        {hint && <span className="text-[11px] text-neutral-500">{hint}</span>}
      </legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}
