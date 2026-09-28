'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BellIcon, TrashIcon } from '@heroicons/react/24/outline';
import { apiJson, btnPrimary, btnGhost, inputCls, Skeleton, ErrorState } from '@/components/radar/asset/ui';

export interface AlertRule {
  id: string;
  kind: string;
  channel: 'email' | 'slack' | 'in_app';
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}
interface RulesResp { rules: AlertRule[]; hasProAccess: boolean }
interface MandateOption { id: string; name: string }

type Kind = 'score_threshold' | 'partnership_change' | 'catalyst_upcoming' | 'watchlist_activity' | 'mandate_digest';

const KIND_LABEL: Record<string, string> = {
  score_threshold: 'Score crosses',
  partnership_change: 'Partnership changes',
  catalyst_upcoming: 'Catalyst within',
  watchlist_activity: 'Score moves by',
  mandate_digest: 'Mandate digest',
};

/** One line per rule: what fires it, and where it applies when not pinned to the current asset. */
export function describeRule(r: AlertRule, opts: { assetNames?: Record<string, string>; mandateNames?: Record<string, string>; onAssetPage?: boolean } = {}): string {
  const c = r.config;
  let what: string;
  switch (r.kind) {
    case 'score_threshold': what = `Score crosses ${c.direction === 'below' ? 'below' : c.direction === 'either' ? '' : 'above'} ${c.threshold}`.replace(/\s+/g, ' '); break;
    case 'catalyst_upcoming': what = `Catalyst within ${c.days_ahead ?? 30} days`; break;
    case 'watchlist_activity': what = `Score moves ≥ ${c.min_delta ?? 5} pts on a watched asset`; break;
    case 'partnership_change': what = 'Partnership status changes'; break;
    case 'mandate_digest': {
      const id = typeof c.mandate_id === 'string' ? c.mandate_id : null;
      what = id ? `Digest for “${opts.mandateNames?.[id] ?? 'mandate'}”` : 'Digest for every active mandate';
      break;
    }
    default: what = KIND_LABEL[r.kind] ?? r.kind;
  }
  const assetId = typeof c.asset_id === 'string' ? c.asset_id : null;
  if (assetId && !opts.onAssetPage) what += ` · ${opts.assetNames?.[assetId] ?? 'one asset'}`;
  else if (!assetId && (r.kind === 'score_threshold' || r.kind === 'partnership_change' || r.kind === 'catalyst_upcoming')) what += ' · any watched asset';
  return what;
}

/**
 * Alert rules, either pinned to one asset (`assetId`, the brief sidebar) or
 * account-wide (the Alerts page): watched-asset rules, watchlist activity
 * and mandate digests. The daily radar-digest cron evaluates them
 * (lib/radar/notifications.ts).
 */
export function AlertRuleForm({ assetId, mandates = [] }: { assetId?: string; mandates?: MandateOption[] }) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [assetNames, setAssetNames] = useState<Record<string, string>>({});
  const [hasPro, setHasPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<Kind>('score_threshold');
  const [channel, setChannel] = useState<'in_app' | 'email' | 'slack'>('in_app');
  const [threshold, setThreshold] = useState(70);
  const [direction, setDirection] = useState<'above' | 'below' | 'either'>('above');
  const [days, setDays] = useState(30);
  const [minDelta, setMinDelta] = useState(5);
  const [mandateId, setMandateId] = useState<string>('');
  const [webhook, setWebhook] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiJson<RulesResp & { asset_names?: Record<string, string> }>(`/api/radar/alerts${assetId ? `?asset_id=${assetId}` : ''}`);
      setRules(data.rules); setHasPro(data.hasProAccess); setAssetNames(data.asset_names ?? {});
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load alerts'); } finally { setLoading(false); }
  }, [assetId]);
  useEffect(() => { void load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const config: Record<string, unknown> = {};
    if (assetId && kind !== 'watchlist_activity' && kind !== 'mandate_digest') config.asset_id = assetId;
    if (kind === 'score_threshold') { config.threshold = threshold; config.direction = direction; }
    if (kind === 'catalyst_upcoming') config.days_ahead = days;
    if (kind === 'watchlist_activity') config.min_delta = minDelta;
    if (kind === 'mandate_digest' && mandateId) config.mandate_id = mandateId;
    if (channel === 'slack') config.webhook_url = webhook.trim();
    try {
      const data = await apiJson<{ rule: AlertRule }>('/api/radar/alerts', { method: 'POST', body: JSON.stringify({ kind, channel, config }) });
      setRules(r => [data.rule, ...r]);
      setWebhook('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create alert'); } finally { setBusy(false); }
  };
  const toggle = async (r: AlertRule) => {
    try {
      const data = await apiJson<{ rule: AlertRule }>(`/api/radar/alerts?id=${r.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !r.is_active }) });
      setRules(rs => rs.map(x => x.id === r.id ? data.rule : x));
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
  };
  const remove = async (r: AlertRule) => {
    try {
      await apiJson(`/api/radar/alerts?id=${r.id}`, { method: 'DELETE' });
      setRules(rs => rs.filter(x => x.id !== r.id));
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
  };

  const mandateNames = Object.fromEntries(mandates.map(m => [m.id, m.name]));
  const label = 'block text-xs text-neutral-600 dark:text-neutral-300';
  const cap = 'text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400';

  return (
    <div>
      {loading ? <Skeleton lines={2} /> : rules.length > 0 ? (
        <ul className="mb-3 space-y-1.5" aria-label={assetId ? 'Alert rules for this asset' : 'Alert rules'}>
          {rules.map(r => {
            const pinned = typeof r.config.asset_id === 'string' ? r.config.asset_id : null;
            return (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs dark:border-neutral-800">
                <span className={r.is_active ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-400 line-through'}>
                  <BellIcon className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden="true" />
                  {describeRule(r, { assetNames, mandateNames, onAssetPage: !!assetId })}
                  <span className="text-neutral-500 dark:text-neutral-400"> · {r.channel.replace('_', '-')}</span>
                  {pinned && !assetId && <Link href={`/radar/${pinned}`} className="ml-1.5 text-teal-700 hover:underline dark:text-teal-300">open</Link>}
                </span>
                <span className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => toggle(r)} className={btnGhost} aria-pressed={r.is_active}>{r.is_active ? 'Pause' : 'Resume'}</button>
                  <button type="button" onClick={() => remove(r)} className={btnGhost} aria-label="Delete alert rule"><TrashIcon className="h-3.5 w-3.5" aria-hidden="true" /></button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : !assetId ? (
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">No rules yet. Rules that name no asset apply to everything on your watchlist.</p>
      ) : null}
      <form onSubmit={create} className="space-y-2" aria-label="Add alert rule">
        <div className="grid grid-cols-2 gap-2">
          <label className={label}>
            <span className={cap}>Alert when</span>
            <select value={kind} onChange={e => setKind(e.target.value as Kind)} className={inputCls}>
              <option value="score_threshold">Score crosses a threshold</option>
              <option value="partnership_change">Partnership status changes</option>
              <option value="catalyst_upcoming">Catalyst is upcoming</option>
              {!assetId && <option value="watchlist_activity">A watched asset&apos;s score moves</option>}
              {!assetId && <option value="mandate_digest">Mandate digest is ready</option>}
            </select>
          </label>
          <label className={label}>
            <span className={cap}>Deliver via</span>
            <select value={channel} onChange={e => setChannel(e.target.value as typeof channel)} className={inputCls}>
              <option value="in_app">In-app</option>
              <option value="email" disabled={!hasPro}>Email{hasPro ? '' : ' (Pro)'}</option>
              <option value="slack" disabled={!hasPro}>Slack webhook{hasPro ? '' : ' (Pro)'}</option>
            </select>
          </label>
        </div>
        {kind === 'score_threshold' && (
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>
              <span className={cap}>Threshold (0-100)</span>
              <input type="number" min={0} max={100} value={threshold} onChange={e => setThreshold(Number(e.target.value))} className={inputCls} required />
            </label>
            <label className={label}>
              <span className={cap}>Direction</span>
              <select value={direction} onChange={e => setDirection(e.target.value as typeof direction)} className={inputCls}>
                <option value="above">Rises above</option><option value="below">Falls below</option><option value="either">Either</option>
              </select>
            </label>
          </div>
        )}
        {kind === 'catalyst_upcoming' && (
          <label className={label}>
            <span className={cap}>Days ahead</span>
            <input type="number" min={1} max={365} value={days} onChange={e => setDays(Number(e.target.value))} className={inputCls} required />
          </label>
        )}
        {kind === 'watchlist_activity' && (
          <label className={label}>
            <span className={cap}>Minimum move (points)</span>
            <input type="number" min={1} max={100} value={minDelta} onChange={e => setMinDelta(Number(e.target.value))} className={inputCls} required />
          </label>
        )}
        {kind === 'mandate_digest' && (
          <label className={label}>
            <span className={cap}>Mandate</span>
            <select value={mandateId} onChange={e => setMandateId(e.target.value)} className={inputCls}>
              <option value="">Every active mandate</option>
              {mandates.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}
        {channel === 'slack' && (
          <label className={label}>
            <span className={cap}>Slack incoming webhook URL</span>
            <input type="url" value={webhook} onChange={e => setWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/…" className={inputCls} required pattern="https://hooks\.slack\.com/.*" />
          </label>
        )}
        <button type="submit" disabled={busy} className={btnPrimary}>Add alert</button>
      </form>
      {error && <div className="mt-2"><ErrorState message={error} /></div>}
      <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
        {assetId ? 'Evaluated daily after scoring. Mandate digests are configured on the mandate itself.' : 'Evaluated daily after scoring. Per-asset rules are added from the asset brief.'}
      </p>
    </div>
  );
}
