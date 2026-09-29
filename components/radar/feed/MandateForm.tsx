'use client';

/**
 * Mandate composer. The user describes the search in plain language
 * ("Phase 2 ADCs in solid tumours from Korea, ex-Asia rights"); a local
 * parser (lib/radar/client/intent-parse.ts, no model, no network) turns it
 * into criteria shown as removable chips. Only the questions the text did
 * not answer are asked next, one at a time, each with live counts from the
 * facets endpoint so every choice shows how many assets it leaves. Users who
 * prefer to click can open every criterion at once.
 *
 * Same props as the previous form, so the first-run panel, "Save as
 * mandate" and mandate editing are unchanged.
 */

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CheckIcon, ChevronDownIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/20/solid';
import {
  RADAR_TA_OPTIONS,
  RADAR_MODALITY_OPTIONS,
  RADAR_PHASE_OPTIONS,
  RADAR_PHASE_RANK,
  RADAR_PARTNERSHIP_OPTIONS,
  RADAR_REGION_OPTIONS,
  RADAR_COUNTRY_OPTIONS,
  radarLabel,
} from '@/lib/radar/vocab';
import { EMPTY_FILTERS, RADAR_RIGHTS_OPTIONS, type RadarFilterState } from '@/lib/radar/client/filter-schema';
import type { FacetBucket, RadarMandate } from '@/lib/radar/client/api-types';
import { useFacets, useMatchCount } from '@/lib/radar/client/hooks';
import { filtersToMandateFields, mandateToFilters, unsavedFilterKeys, type DigestFrequency, type MandateFields } from '@/lib/radar/client/mandate';
import { QUESTION_ORDER, answeredDimensions, parseMandateText, suggestMandateName, type ParsedDimension } from '@/lib/radar/client/intent-parse';
import { FACET_TITLES, fmtEstimate, fmtInt, phaseShort } from '@/lib/radar/client/format';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, FOCUS_RING, Spinner, cn } from './ui';

interface Props {
  initial?: RadarFilterState;
  initialName?: string;
  initialDescription?: string | null;
  mandate?: RadarMandate | null;
  submitLabel?: string;
  saving?: boolean;
  error?: string | null;
  onSubmit: (fields: MandateFields, filters: RadarFilterState) => Promise<void> | void;
  onCancel?: () => void;
  onPreview?: (filters: RadarFilterState) => void;
}

type Dim = ParsedDimension;

const DIM_META: Record<Dim, { question: string; title: string; tone: string }> = {
  ta: { question: 'Which therapeutic areas?', title: 'Therapeutic area', tone: 'bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/30' },
  modality: { question: 'Which modalities?', title: 'Modality', tone: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/30' },
  phase: { question: 'Which development stages?', title: 'Stage', tone: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30' },
  region: { question: 'Where should the originator be?', title: 'Geography', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30' },
  country: { question: 'Where should the originator be?', title: 'Country', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30' },
  rights: { question: 'Which territories do you need rights in?', title: 'Rights available', tone: 'bg-teal-50 text-teal-800 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-200 dark:ring-teal-500/30' },
  partnership: { question: 'Partnership status?', title: 'Partnership', tone: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30' },
  owner_type: { question: 'Who owns it?', title: 'Owner', tone: 'bg-neutral-100 text-neutral-800 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700' },
};

const EXAMPLES = [
  'Phase 2 ADCs in solid tumours from Korea or Japan, ex-Asia rights',
  'Preclinical gene therapy for rare disease, worldwide rights, unpartnered',
  'Late-stage immunology biologics from Europe',
  'Chinese bispecifics in oncology with ex-China rights',
  'Academic siRNA programs in cardiometabolic',
];

const COUNTRY_LABEL: Record<string, string> = Object.fromEntries(RADAR_COUNTRY_OPTIONS.map(o => [o.value, o.label]));
const RIGHTS_LABEL: Record<string, string> = Object.fromEntries(RADAR_RIGHTS_OPTIONS.map(o => [o.value, o.label]));

function valueLabel(dim: Dim, v: string): string {
  if (dim === 'country') return COUNTRY_LABEL[v] ?? v;
  if (dim === 'rights') return RIGHTS_LABEL[v] ?? v;
  if (dim === 'owner_type') return v === 'academic' ? 'Academic' : v === 'hospital' ? 'Hospital' : v === 'industry' ? 'Industry' : v;
  return radarLabel(v);
}

function countOf(buckets: FacetBucket[] | undefined, value: string): number | null {
  if (!buckets) return null;
  return buckets.find(b => b.value === value)?.count ?? 0;
}

export function MandateForm({ initial, initialName, initialDescription, mandate, submitLabel = 'Save mandate', saving, error, onSubmit, onCancel, onPreview }: Props) {
  const start = useMemo<RadarFilterState>(() => {
    if (mandate) return mandateToFilters(mandate);
    return initial ?? { ...EMPTY_FILTERS, partnership: ['unpartnered', 'partially_partnered'] };
  }, [initial, mandate]);

  const [filters, setFilters] = useState<RadarFilterState>(start);
  const [brief, setBrief] = useState(initialDescription && !mandate ? '' : '');
  const [name, setName] = useState(mandate?.name ?? initialName ?? '');
  const [nameTouched, setNameTouched] = useState(!!(mandate?.name || initialName));
  const [skipped, setSkipped] = useState<Set<Dim>>(new Set());
  const [showAll, setShowAll] = useState(!!mandate);
  const [notifyEmail, setNotifyEmail] = useState(mandate?.notify_email ?? false);
  const [notifyInApp, setNotifyInApp] = useState(mandate?.notify_in_app ?? true);
  const [digest, setDigest] = useState<DigestFrequency>(mandate?.digest_frequency ?? 'daily');
  const [nameError, setNameError] = useState<string | null>(null);
  const [exampleIdx, setExampleIdx] = useState(0);
  const briefRef = useRef<HTMLTextAreaElement>(null);

  // Rotate the placeholder example while the box is empty.
  useEffect(() => {
    if (brief) return;
    const t = window.setInterval(() => setExampleIdx(i => (i + 1) % EXAMPLES.length), 4000);
    return () => window.clearInterval(t);
  }, [brief]);

  const commit = (next: RadarFilterState) => {
    setFilters(next);
    onPreview?.(next);
  };

  // Typing re-parses and merges into the criteria (parsed values replace their dimension).
  const parsed = useMemo(() => parseMandateText(brief), [brief]);
  const lastApplied = useRef<string>('');
  useEffect(() => {
    const key = JSON.stringify(parsed.filters);
    if (key === lastApplied.current) return;
    lastApplied.current = key;
    if (!brief.trim()) return;
    const p = parsed.filters;
    const next: RadarFilterState = { ...filters };
    if (p.ta.length) next.ta = p.ta;
    if (p.modality.length) next.modality = p.modality;
    if (p.phase_min || p.phase_max) { next.phase_min = p.phase_min; next.phase_max = p.phase_max; next.phase = []; }
    if (p.country.length) next.country = p.country;
    if (p.region.length) next.region = p.region;
    if (p.rights.length) next.rights = p.rights;
    if (p.partnership.length) next.partnership = p.partnership;
    if (p.owner_type.length) next.owner_type = p.owner_type;
    commit(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- merge only when the parse result changes
  }, [parsed]);

  // Name follows the criteria until the user edits it.
  useEffect(() => {
    if (!nameTouched) setName(suggestMandateName(filters, v => radarLabel(v)));
  }, [filters, nameTouched]);

  const { count, status: countStatus } = useMatchCount(filters, true);
  const facets = useFacets(filters, true);
  const unsaved = unsavedFilterKeys(filters).filter(k => k !== 'owner_type');
  const answered = answeredDimensions(filters);
  const open = QUESTION_ORDER.filter(d => !answered.has(d) && !skipped.has(d));
  const nextQuestions = showAll ? QUESTION_ORDER : open.slice(0, 1);

  const setDim = (dim: Dim, values: string[]) => {
    const next: RadarFilterState = { ...filters };
    if (dim === 'phase') return;
    (next[dim] as string[]) = values;
    commit(next);
  };
  const toggle = (dim: Dim, v: string) => {
    const cur = filters[dim] as string[];
    setDim(dim, cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]);
  };
  const skip = (dim: Dim) => setSkipped(s => new Set(s).add(dim));
  const reopen = (dim: Dim) => setSkipped(s => { const n = new Set(s); n.delete(dim); return n; });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setNameError('Give the mandate a name'); return; }
    setNameError(null);
    const fields = filtersToMandateFields(filters, {
      name: trimmed,
      notify_email: notifyEmail,
      notify_in_app: notifyInApp,
      digest_frequency: digest,
      description: brief.trim() || mandate?.description || initialDescription || null,
    });
    await onSubmit(fields, filters);
  };

  const chips = criteriaChips(filters);
  const removeChip = (dim: Dim, v: string) => {
    if (dim === 'phase') commit({ ...filters, phase_min: null, phase_max: null, phase: [] });
    else toggle(dim, v);
  };

  return (
    <form onSubmit={submit} className="space-y-5" aria-describedby="mandate-live-count">
      {/* ── Brief ─────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="mandate-brief" className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
          <SparklesIcon className="h-4 w-4 text-teal-600" aria-hidden />
          Describe what you are looking for
        </label>
        <div className="relative mt-2">
          <textarea
            id="mandate-brief"
            ref={briefRef}
            value={brief}
            onChange={e => setBrief(e.target.value)}
            rows={2}
            placeholder={EXAMPLES[exampleIdx]}
            className={cn(
              'block w-full resize-none rounded-xl border border-neutral-300 bg-white px-4 py-3 text-[15px] leading-relaxed text-neutral-900 shadow-sm placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100',
              FOCUS_RING,
            )}
          />
        </div>
        <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          Area, modality, stage, geography and rights are picked up as you type. Anything else stays as a keyword.
        </p>
      </div>

      {/* ── What it understood ─────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Criteria</p>
          <LiveCount count={count} status={countStatus} />
        </div>
        {chips.length === 0 ? (
          <p className="mt-2 text-[13px] text-neutral-500 dark:text-neutral-400">No criteria yet: every indexed asset matches.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Criteria">
            {chips.map(c => (
              <li key={`${c.dim}-${c.value}`}>
                <span className={cn('inline-flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1 text-[12px] font-medium ring-1 ring-inset', DIM_META[c.dim].tone)}>
                  <span className="opacity-60">{DIM_META[c.dim].title}:</span>
                  {c.label}
                  <button type="button" onClick={() => removeChip(c.dim, c.value)} className={cn('ml-0.5 rounded-full p-0.5 hover:bg-black/5 dark:hover:bg-white/10', FOCUS_RING)} aria-label={`Remove ${c.label}`}>
                    <XMarkIcon className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {parsed.leftover && (
          <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
            Kept as keywords: <span className="font-medium text-neutral-800 dark:text-neutral-200">{parsed.leftover}</span>
          </p>
        )}
      </div>

      {/* ── Follow-up questions ─────────────────────────────────────── */}
      <div className="space-y-3">
        {nextQuestions.map(dim => (
          <Question
            key={dim}
            dim={dim}
            filters={filters}
            facets={facets.facets}
            answered={answered.has(dim)}
            skipped={skipped.has(dim)}
            onToggle={toggle}
            onPhase={(min, max) => commit({ ...filters, phase_min: min, phase_max: max, phase: [] })}
            onSkip={() => skip(dim)}
            onReopen={() => reopen(dim)}
            compact={showAll}
          />
        ))}
        {!showAll && open.length === 0 && (
          <p className="flex items-center gap-1.5 text-[13px] text-neutral-600 dark:text-neutral-400">
            <CheckIcon className="h-4 w-4 text-teal-600" aria-hidden /> Every criterion is set or left open.
          </p>
        )}
        <button type="button" onClick={() => setShowAll(v => !v)} className={cn(BTN_GHOST, 'px-2 text-[12px]')}>
          <ChevronDownIcon className={cn('h-4 w-4 transition-transform', showAll && 'rotate-180')} aria-hidden />
          {showAll ? 'Ask one question at a time' : 'Show every criterion'}
        </button>
      </div>

      {/* ── Name and notifications ──────────────────────────────────── */}
      <div className="grid gap-4 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <label htmlFor="mandate-name" className="block text-[12px] font-semibold text-neutral-800 dark:text-neutral-200">Mandate name</label>
          <input
            id="mandate-name"
            value={name}
            onChange={e => { setName(e.target.value); setNameTouched(true); }}
            maxLength={120}
            aria-invalid={nameError ? true : undefined}
            className={cn('mt-1 h-10 w-full rounded-lg border bg-white px-3 text-[14px] text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100', nameError ? 'border-amber-600' : 'border-neutral-300 dark:border-neutral-700', FOCUS_RING)}
          />
          {nameError && <p role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-300">{nameError}</p>}
        </div>
        <fieldset>
          <legend className="text-[12px] font-semibold text-neutral-800 dark:text-neutral-200">New matches</legend>
          <div className="mt-1 flex h-10 items-center gap-3 text-[13px] text-neutral-800 dark:text-neutral-200">
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={notifyInApp} onChange={e => setNotifyInApp(e.target.checked)} className={cn('h-4 w-4 rounded border-neutral-400 text-teal-600', FOCUS_RING)} />In-app</label>
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={notifyEmail} onChange={e => setNotifyEmail(e.target.checked)} className={cn('h-4 w-4 rounded border-neutral-400 text-teal-600', FOCUS_RING)} />Email</label>
            <select value={digest} onChange={e => setDigest(e.target.value as DigestFrequency)} aria-label="Digest frequency" className={cn('h-8 rounded-lg border border-neutral-300 bg-white px-2 text-[13px] dark:border-neutral-700 dark:bg-neutral-950', FOCUS_RING)}>
              <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="realtime">As it happens</option>
            </select>
          </div>
        </fieldset>
      </div>

      {unsaved.length > 0 && (
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Applied to the feed but not stored with the mandate: {unsaved.map(k => (k === 'q' ? 'search text' : k === 'phase' ? 'individual phase picks (kept as a range)' : FACET_TITLES[k as keyof typeof FACET_TITLES]?.toLowerCase() ?? k)).join(', ')}.
        </p>
      )}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        {onCancel && <button type="button" onClick={onCancel} className={BTN_SECONDARY} disabled={saving}>Cancel</button>}
        <button type="submit" className={cn(BTN_PRIMARY, 'px-5 py-2.5 text-[13px]')} disabled={saving}>
          {saving && <Spinner className="border-white/40 border-t-white" />}
          {submitLabel}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">{error}</p>}
    </form>
  );
}

// ── Criteria chips ───────────────────────────────────────────────────────

function criteriaChips(f: RadarFilterState): Array<{ dim: Dim; value: string; label: string }> {
  const out: Array<{ dim: Dim; value: string; label: string }> = [];
  for (const v of f.ta) out.push({ dim: 'ta', value: v, label: radarLabel(v) });
  for (const v of f.modality) out.push({ dim: 'modality', value: v, label: radarLabel(v) });
  if (f.phase_min || f.phase_max) {
    const lo = f.phase_min ? radarLabel(f.phase_min) : 'Any';
    const hi = f.phase_max ? radarLabel(f.phase_max) : 'Any';
    out.push({ dim: 'phase', value: 'range', label: f.phase_min === f.phase_max ? lo : `${lo} to ${hi}` });
  }
  for (const v of f.country) out.push({ dim: 'country', value: v, label: COUNTRY_LABEL[v] ?? v });
  for (const v of f.region) out.push({ dim: 'region', value: v, label: radarLabel(v) });
  for (const v of f.rights) out.push({ dim: 'rights', value: v, label: RIGHTS_LABEL[v] ?? v });
  for (const v of f.partnership) out.push({ dim: 'partnership', value: v, label: radarLabel(v) });
  for (const v of f.owner_type) out.push({ dim: 'owner_type', value: v, label: valueLabel('owner_type', v) });
  return out;
}

function LiveCount({ count, status }: { count: number | null; status: string }) {
  return (
    <p id="mandate-live-count" className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[13px] shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800" aria-live="polite">
      {status === 'loading' && <Spinner />}
      {count === null ? (
        <span className="text-neutral-500">{status === 'error' ? 'Count unavailable' : 'Counting'}</span>
      ) : (
        <>
          <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{fmtEstimate(count)}</span>
          <span className="text-neutral-600 dark:text-neutral-400">{count === 1 ? 'asset matches' : 'assets match'}</span>
        </>
      )}
    </p>
  );
}

// ── One question ─────────────────────────────────────────────────────────

function Question(props: {
  dim: Dim;
  filters: RadarFilterState;
  facets: Record<string, FacetBucket[]> | null;
  answered: boolean;
  skipped: boolean;
  compact: boolean;
  onToggle: (dim: Dim, v: string) => void;
  onPhase: (min: string | null, max: string | null) => void;
  onSkip: () => void;
  onReopen: () => void;
}) {
  const { dim, filters, facets, answered, skipped, compact, onToggle, onPhase, onSkip, onReopen } = props;
  const meta = DIM_META[dim];
  let body: ReactNode = null;

  if (dim === 'phase') {
    body = <StageTrack filters={filters} buckets={facets?.phase} onChange={onPhase} />;
  } else if (dim === 'region') {
    body = (
      <div className="space-y-2.5">
        <OptionGrid dim="region" options={RADAR_REGION_OPTIONS.map(o => ({ value: o.value, label: o.label }))} selected={filters.region} buckets={facets?.region} onToggle={onToggle} />
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Or specific countries</p>
          <OptionGrid dim="country" options={RADAR_COUNTRY_OPTIONS.map(o => ({ value: o.value, label: o.label }))} selected={filters.country} buckets={facets?.country} onToggle={onToggle} limit={12} />
        </div>
      </div>
    );
  } else {
    const opts =
      dim === 'ta' ? RADAR_TA_OPTIONS.map(o => ({ value: o.value, label: o.longLabel ?? o.label })) :
      dim === 'modality' ? RADAR_MODALITY_OPTIONS.map(o => ({ value: o.value, label: o.longLabel ?? o.label })) :
      dim === 'rights' ? RADAR_RIGHTS_OPTIONS.map(o => ({ value: o.value, label: o.label, hint: o.longLabel })) :
      dim === 'partnership' ? RADAR_PARTNERSHIP_OPTIONS.map(o => ({ value: o.value, label: o.longLabel ?? o.label })) :
      [{ value: 'industry', label: 'Industry' }, { value: 'academic', label: 'Academic' }, { value: 'hospital', label: 'Hospital' }];
    body = <OptionGrid dim={dim} options={opts} selected={filters[dim] as string[]} buckets={facets?.[dim]} onToggle={onToggle} />;
  }

  if (skipped && !compact) return null;
  return (
    <section className={cn('rounded-xl border bg-white p-4 dark:bg-neutral-950', answered ? 'border-neutral-200 dark:border-neutral-800' : 'border-teal-300 shadow-sm shadow-teal-600/5 dark:border-teal-700')} aria-label={meta.question}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-neutral-900 dark:text-neutral-100">{compact ? meta.title : meta.question}</h3>
        {skipped ? (
          <button type="button" onClick={onReopen} className={cn(BTN_GHOST, 'px-2 text-[12px]')}>Set it</button>
        ) : !answered ? (
          <button type="button" onClick={onSkip} className={cn(BTN_GHOST, 'px-2 text-[12px]')}>Any is fine</button>
        ) : null}
      </div>
      {body}
    </section>
  );
}

function OptionGrid({ dim, options, selected, buckets, onToggle, limit }: {
  dim: Dim;
  options: Array<{ value: string; label: string; hint?: string }>;
  selected: string[];
  buckets: FacetBucket[] | undefined;
  onToggle: (dim: Dim, v: string) => void;
  limit?: number;
}) {
  const [more, setMore] = useState(false);
  const withCounts = options
    .map(o => ({ ...o, count: countOf(buckets, o.value) }))
    .sort((a, b) => Number(selected.includes(b.value)) - Number(selected.includes(a.value)) || (b.count ?? 0) - (a.count ?? 0));
  const max = Math.max(1, ...withCounts.map(o => o.count ?? 0));
  const shown = limit && !more ? withCounts.slice(0, limit) : withCounts;
  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {shown.map(o => {
          const on = selected.includes(o.value);
          const empty = o.count === 0 && !on;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(dim, o.value)}
              title={o.hint}
              className={cn(
                'group relative overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors motion-reduce:transition-none',
                on ? 'border-teal-600 bg-teal-50 dark:border-teal-500 dark:bg-teal-500/10' : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700',
                empty && 'opacity-50',
                FOCUS_RING,
              )}
            >
              {o.count !== null && (
                <span aria-hidden className={cn('absolute inset-y-0 left-0', on ? 'bg-teal-500/10' : 'bg-neutral-500/[0.06] dark:bg-white/[0.04]')} style={{ width: `${Math.round(((o.count ?? 0) / max) * 100)}%` }} />
              )}
              <span className="relative flex items-center justify-between gap-2">
                <span className={cn('truncate text-[13px]', on ? 'font-semibold text-teal-900 dark:text-teal-100' : 'font-medium text-neutral-800 dark:text-neutral-200')}>{o.label}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">{o.count === null ? '' : fmtInt(o.count)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {limit && withCounts.length > limit && (
        <button type="button" onClick={() => setMore(m => !m)} className={cn(BTN_GHOST, 'mt-1.5 px-2 text-[12px]')}>
          {more ? 'Fewer' : `${withCounts.length - limit} more`}
        </button>
      )}
    </div>
  );
}

/** Stage selector: one column per phase, bar height = assets in the current criteria; click to set the range ends. */
export function StageTrack({ filters, buckets, onChange, compact = false }: { filters: Pick<RadarFilterState, 'phase_min' | 'phase_max'>; buckets: FacetBucket[] | undefined; onChange: (min: string | null, max: string | null) => void; compact?: boolean }) {
  const phases = RADAR_PHASE_OPTIONS.filter(o => o.value !== 'phase_4');
  const counts = phases.map(p => countOf(buckets, p.value) ?? 0);
  const max = Math.max(1, ...counts);
  const lo = filters.phase_min ? RADAR_PHASE_RANK[filters.phase_min] ?? null : null;
  const hi = filters.phase_max ? RADAR_PHASE_RANK[filters.phase_max] ?? null : null;
  const inRange = (v: string) => {
    const r = RADAR_PHASE_RANK[v] ?? 0;
    if (lo === null && hi === null) return false;
    return r >= (lo ?? -Infinity) && r <= (hi ?? Infinity);
  };
  const click = (v: string) => {
    const r = RADAR_PHASE_RANK[v] ?? 0;
    if (lo === null || (lo !== null && hi !== null && lo !== hi)) return onChange(v, v);
    if (r < lo) return onChange(v, filters.phase_min);
    return onChange(filters.phase_min, v);
  };
  return (
    <div>
      <div className={cn('flex items-end', compact ? 'gap-0.5' : 'gap-1.5')} role="group" aria-label="Development stage">
        {phases.map((p, i) => {
          const on = inRange(p.value);
          return (
            <button
              key={p.value}
              type="button"
              aria-pressed={on}
              onClick={() => click(p.value)}
              title={`${p.longLabel ?? p.label}: ${fmtInt(counts[i])} assets`}
              className={cn('group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg', compact ? 'p-0.5' : 'p-1', FOCUS_RING)}
            >
              <span className={cn('flex w-full items-end', compact ? 'h-12' : 'h-20')}>
                <span
                  className={cn('w-full rounded-md transition-all motion-reduce:transition-none', on ? 'bg-teal-600' : 'bg-neutral-200 group-hover:bg-neutral-300 dark:bg-neutral-800 dark:group-hover:bg-neutral-700')}
                  style={{ height: `${Math.max(6, Math.round((counts[i] / max) * 100))}%` }}
                />
              </span>
              <span className={cn('truncate font-semibold', compact ? 'text-[10px]' : 'text-[12px]', on ? 'text-teal-800 dark:text-teal-200' : 'text-neutral-700 dark:text-neutral-300')}>{phaseShort(p.value)}</span>
              {!compact && <span className="text-[11px] tabular-nums text-neutral-500">{fmtInt(counts[i])}</span>}
            </button>
          );
        })}
      </div>
      {!compact && <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">Click a stage, then another to set a range. Approved products stay out unless you ask for them in the feed.</p>}
      {(filters.phase_min || filters.phase_max) && (
        <button type="button" onClick={() => onChange(null, null)} className={cn(BTN_GHOST, 'mt-1 px-2 text-[12px]')}>Clear stage</button>
      )}
    </div>
  );
}
