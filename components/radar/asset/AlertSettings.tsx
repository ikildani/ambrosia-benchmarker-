'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellIcon, TrashIcon } from '@heroicons/react/24/outline';
import { apiJson, btnPrimary, btnGhost, inputCls, Skeleton, ErrorState } from './ui';

interface Rule { id: string; kind: string; channel: 'email' | 'slack' | 'in_app'; config: Record<string, unknown>; is_active: boolean; created_at: string }
interface RulesResp { rules: Rule[]; hasProAccess: boolean }

const KIND_LABEL: Record<string, string> = {
  score_threshold: 'Score crosses',
  partnership_change: 'Partnership changes',
  catalyst_upcoming: 'Catalyst within',
  watchlist_activity: 'Score moves by',
  mandate_digest: 'Mandate digest',
};

function describe(r: Rule): string {
  const c = r.config;
  switch (r.kind) {
    case 'score_threshold': return `Score crosses ${c.direction === 'below' ? 'below' : c.direction === 'either' ? '' : 'above'} ${c.threshold}`;
    case 'catalyst_upcoming': return `Catalyst within ${c.days_ahead ?? 30} days`;
    case 'watchlist_activity': return `Score moves ≥ ${c.min_delta ?? 5} pts`;
    case 'partnership_change': return 'Partnership status changes';
    default: return KIND_LABEL[r.kind] ?? r.kind;
  }
}

/**
 * Per-asset alert rules: score threshold, partnership change, catalyst
 * window. Rules are pinned to this asset via config.asset_id; the daily
 * radar-digest cron evaluates them (lib/radar/notifications.ts).
 */
export function AlertSettings({ assetId }: { assetId: string }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [hasPro, setHasPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<'score_threshold' | 'partnership_change' | 'catalyst_upcoming'>('score_threshold');
  const [channel, setChannel] = useState<'in_app' | 'email' | 'slack'>('in_app');
  const [threshold, setThreshold] = useState(70);
  const [direction, setDirection] = useState<'above' | 'below' | 'either'>('above');
  const [days, setDays] = useState(30);
  const [webhook, setWebhook] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiJson<RulesResp>(`/api/radar/alerts?asset_id=${assetId}`);
      setRules(data.rules); setHasPro(data.hasProAccess);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load alerts'); } finally { setLoading(false); }
  }, [assetId]);
  useEffect(() => { void load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const config: Record<string, unknown> = { asset_id: assetId };
    if (kind === 'score_threshold') { config.threshold = threshold; config.direction = direction; }
    if (kind === 'catalyst_upcoming') config.days_ahead = days;
    if (channel === 'slack') config.webhook_url = webhook.trim();
    try {
      const data = await apiJson<{ rule: Rule }>('/api/radar/alerts', { method: 'POST', body: JSON.stringify({ kind, channel, config }) });
      setRules(r => [data.rule, ...r]);
      setWebhook('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create alert'); } finally { setBusy(false); }
  };
  const toggle = async (r: Rule) => {
    try {
      const data = await apiJson<{ rule: Rule }>(`/api/radar/alerts?id=${r.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !r.is_active }) });
      setRules(rs => rs.map(x => x.id === r.id ? data.rule : x));
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
  };
  const remove = async (r: Rule) => {
    try {
      await apiJson(`/api/radar/alerts?id=${r.id}`, { method: 'DELETE' });
      setRules(rs => rs.filter(x => x.id !== r.id));
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
  };

  return (
    <div>
      {loading ? <Skeleton lines={2} /> : rules.length > 0 && (
        <ul className="mb-3 space-y-1.5" aria-label="Alert rules for this asset">
          {rules.map(r => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs dark:border-neutral-800">
              <span className={r.is_active ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-400 line-through'}>
                <BellIcon className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden="true" />
                {describe(r)} <span className="text-neutral-500 dark:text-neutral-400">· {r.channel.replace('_', '-')}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button type="button" onClick={() => toggle(r)} className={btnGhost} aria-pressed={r.is_active}>{r.is_active ? 'Pause' : 'Resume'}</button>
                <button type="button" onClick={() => remove(r)} className={btnGhost} aria-label="Delete alert rule"><TrashIcon className="h-3.5 w-3.5" aria-hidden="true" /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={create} className="space-y-2" aria-label="Add alert rule">
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-neutral-600 dark:text-neutral-300">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Alert when</span>
            <select value={kind} onChange={e => setKind(e.target.value as typeof kind)} className={inputCls}>
              <option value="score_threshold">Score crosses a threshold</option>
              <option value="partnership_change">Partnership status changes</option>
              <option value="catalyst_upcoming">Catalyst is upcoming</option>
            </select>
          </label>
          <label className="block text-xs text-neutral-600 dark:text-neutral-300">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Deliver via</span>
            <select value={channel} onChange={e => setChannel(e.target.value as typeof channel)} className={inputCls}>
              <option value="in_app">In-app</option>
              <option value="email" disabled={!hasPro}>Email{hasPro ? '' : ' (Pro)'}</option>
              <option value="slack" disabled={!hasPro}>Slack webhook{hasPro ? '' : ' (Pro)'}</option>
            </select>
          </label>
        </div>
        {kind === 'score_threshold' && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-neutral-600 dark:text-neutral-300">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Threshold (0-100)</span>
              <input type="number" min={0} max={100} value={threshold} onChange={e => setThreshold(Number(e.target.value))} className={inputCls} required />
            </label>
            <label className="block text-xs text-neutral-600 dark:text-neutral-300">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Direction</span>
              <select value={direction} onChange={e => setDirection(e.target.value as typeof direction)} className={inputCls}>
                <option value="above">Rises above</option><option value="below">Falls below</option><option value="either">Either</option>
              </select>
            </label>
          </div>
        )}
        {kind === 'catalyst_upcoming' && (
          <label className="block text-xs text-neutral-600 dark:text-neutral-300">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Days ahead</span>
            <input type="number" min={1} max={365} value={days} onChange={e => setDays(Number(e.target.value))} className={inputCls} required />
          </label>
        )}
        {channel === 'slack' && (
          <label className="block text-xs text-neutral-600 dark:text-neutral-300">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Slack incoming webhook URL</span>
            <input type="url" value={webhook} onChange={e => setWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/…" className={inputCls} required pattern="https://hooks\.slack\.com/.*" />
          </label>
        )}
        <button type="submit" disabled={busy} className={btnPrimary}>Add alert</button>
      </form>
      {error && <div className="mt-2"><ErrorState message={error} /></div>}
      <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">Evaluated daily after scoring. Mandate digests are configured on the mandate itself.</p>
    </div>
  );
}
