'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shield, Download, Search, RefreshCw } from 'lucide-react';

/**
 * Team audit trail — /portfolio/admin/audit
 *
 * Two sources, both scoped to the admin's team by /api/portfolio/audit:
 *   Estimates      audit_events (migration 100): who ran / exported / shared
 *                  which calculation, with the calculation fingerprint.
 *   Admin actions  audit_log (migration 060): invites, SSO, settings.
 *
 * Filters (member, event type, date range) are applied server-side; CSV export
 * uses the same filters and is itself recorded as an `audit_exported` event.
 */

type Source = 'events' | 'admin';

interface AuditEntry {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  event_type: string;
  resource_type: string;
  resource_id: string | null;
  calculation_fingerprint: string | null;
  metadata: Record<string, unknown>;
  ip_hash: string | null;
  user_agent: string | null;
  status: string | null;
  source: Source;
}

interface MemberOption {
  user_id: string;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
}

const EVENT_LABELS: Record<string, string> = {
  calculation_created: 'Ran estimate',
  calculation_viewed: 'Viewed estimate',
  history_viewed: 'Viewed history',
  team_history_viewed: 'Viewed team history',
  results_exported: 'Exported results',
  results_shared: 'Shared results',
  share_viewed: 'Share link opened',
  report_purchased: 'Purchased report',
  audit_exported: 'Exported audit log',
};

const EVENT_TONE: Record<string, string> = {
  calculation_created: 'bg-teal-500/10 text-teal-300 ring-teal-500/30',
  results_exported: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  results_shared: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
  report_purchased: 'bg-purple-500/10 text-purple-300 ring-purple-500/30',
  audit_exported: 'bg-rose-500/10 text-rose-300 ring-rose-500/30',
};

const PAGE_SIZE = 100;

function labelFor(eventType: string): string {
  return EVENT_LABELS[eventType] || eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function whoLabel(e: AuditEntry): string {
  return e.user_name || e.user_email?.split('@')[0] || '—';
}

function summarise(e: AuditEntry): string {
  const m = e.metadata || {};
  const parts: string[] = [];
  if (typeof m.format === 'string') parts.push(m.format.toUpperCase());
  const phase = typeof m.development_phase === 'string' ? m.development_phase : typeof m.phase === 'string' ? m.phase : null;
  const modality = typeof m.modality === 'string' ? m.modality : null;
  const indication = typeof m.indication === 'string' ? m.indication : null;
  if (phase || modality || indication) parts.push([phase, modality, indication].filter(Boolean).join(' · '));
  if (typeof m.upfront_mid === 'number') parts.push(`upfront ~$${Math.round(m.upfront_mid)}M`);
  if (typeof m.count === 'number') parts.push(`${m.count} rows`);
  if (typeof m.rows === 'number') parts.push(`${m.rows} rows`);
  if (e.source === 'admin' && e.resource_id) parts.push(e.resource_id);
  return parts.join(' — ');
}

function pillClass(active: boolean): string {
  return `px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
    active
      ? 'bg-white text-slate-900 shadow-sm'
      : 'text-slate-400 hover:text-white'
  }`;
}

const inputClass =
  'bg-slate-900 border border-slate-800 rounded-full px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500';

export default function AuditLogPage() {
  const [source, setSource] = useState<Source>('events');
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterUser, setFilterUser] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [search, setSearch] = useState('');

  const buildQuery = useCallback((extra: Record<string, string> = {}) => {
    const q = new URLSearchParams({ source, ...extra });
    if (filterUser) q.set('user_id', filterUser);
    if (filterType) q.set('event_type', filterType);
    if (filterFrom) q.set('from', new Date(filterFrom).toISOString());
    if (filterTo) {
      // inclusive end-of-day
      const end = new Date(filterTo);
      end.setDate(end.getDate() + 1);
      q.set('to', end.toISOString());
    }
    return q;
  }, [source, filterUser, filterType, filterFrom, filterTo]);

  const load = useCallback(async (before?: string | null) => {
    const isMore = !!before;
    if (isMore) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const q = buildQuery({ limit: String(PAGE_SIZE), ...(before ? { before } : {}) });
      const res = await fetch(`/api/portfolio/audit?${q.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to load audit trail');
        if (!isMore) setEntries([]);
        return;
      }
      setEntries((prev) => (isMore ? [...prev, ...json.entries] : json.entries));
      setMembers(json.members || []);
      if (Array.isArray(json.event_types) && json.event_types.length) setEventTypes(json.event_types);
      setNextBefore(json.next_before || null);
    } catch {
      setError('Failed to load audit trail');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const s = search.toLowerCase();
    return entries.filter((e) =>
      [whoLabel(e), e.user_email, e.event_type, e.resource_type, e.resource_id, e.calculation_fingerprint, summarise(e)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    );
  }, [entries, search]);

  const exportCSV = () => {
    const q = buildQuery({ format: 'csv' });
    // Server streams the CSV with the same filters and records audit_exported.
    window.location.href = `/api/portfolio/audit?${q.toString()}`;
  };

  const resetFilters = () => {
    setFilterUser(''); setFilterType(''); setFilterFrom(''); setFilterTo(''); setSearch('');
  };

  const hasFilters = !!(filterUser || filterType || filterFrom || filterTo || search);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-teal-400" />
            Audit Trail
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Who ran, exported and shared which estimate, and when. Retained for the life of the team.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={loading || entries.length === 0}
            className="inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-full text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Source toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Audit source" className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-900 border border-slate-800">
          <button role="tab" aria-selected={source === 'events'} onClick={() => { setSource('events'); setFilterType(''); }} className={pillClass(source === 'events')}>
            Estimates
          </button>
          <button role="tab" aria-selected={source === 'admin'} onClick={() => { setSource('admin'); setFilterType(''); }} className={pillClass(source === 'admin')}>
            Admin actions
          </button>
        </div>
        {hasFilters && (
          <button onClick={resetFilters} className="text-xs text-slate-400 hover:text-white underline underline-offset-2">
            Clear filters
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search user, event, fingerprint..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} w-full pl-9`}
          />
        </div>
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className={inputClass} aria-label="Filter by member">
          <option value="">All members</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.name || m.email || m.user_id.slice(0, 8)}{m.status !== 'active' ? ` (${m.status})` : ''}
            </option>
          ))}
        </select>
        {source === 'events' ? (
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={inputClass} aria-label="Filter by event type">
            <option value="">All events</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>{labelFor(t)}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            placeholder="Action (e.g. member_invited)"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={inputClass}
            aria-label="Filter by action"
          />
        )}
        <div className="flex items-center gap-2">
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className={`${inputClass} w-full`} aria-label="From date" />
          <span className="text-slate-600 text-xs">to</span>
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className={`${inputClass} w-full`} aria-label="To date" />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 px-6">
            <p className="text-slate-300 font-medium">No audit events{hasFilters ? ' match these filters' : ' yet'}.</p>
            <p className="text-slate-500 text-sm mt-1">
              {source === 'events'
                ? 'Events appear here the moment a team member runs, exports or shares an estimate.'
                : 'Member, SSO and settings changes are recorded here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">When</th>
                  <th className="text-left px-5 py-3 font-medium">Who</th>
                  <th className="text-left px-5 py-3 font-medium">Event</th>
                  <th className="text-left px-5 py-3 font-medium">Details</th>
                  <th className="text-left px-5 py-3 font-medium">Fingerprint</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((e) => {
                  const d = new Date(e.created_at);
                  return (
                    <tr key={e.id} className="hover:bg-slate-800/30 transition-colors text-sm align-top">
                      <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                        <div className="text-slate-300">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div>{d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-white">{whoLabel(e)}</div>
                        {e.user_email && <div className="text-xs text-slate-500">{e.user_email}</div>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${EVENT_TONE[e.event_type] || 'bg-slate-800 text-slate-300 ring-slate-700'}`}>
                          {labelFor(e.event_type)}
                        </span>
                        {e.status && e.status !== 'success' && (
                          <span className="ml-2 text-xs text-amber-400">{e.status}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-300 text-xs max-w-[320px]">
                        <div className="truncate" title={summarise(e)}>{summarise(e) || <span className="text-slate-600">—</span>}</div>
                        {e.resource_type && (
                          <div className="text-slate-500 mt-0.5">
                            {e.resource_type}{e.resource_id && e.source === 'events' ? ` · ${e.resource_id.slice(0, 8)}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {e.calculation_fingerprint || <span className="text-slate-600">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {filtered.length} {filtered.length === 1 ? 'event' : 'events'}{search ? ' matching' : ''}
          {entries.length !== filtered.length ? ` of ${entries.length} loaded` : ''}
        </p>
        {nextBefore && (
          <button
            onClick={() => load(nextBefore)}
            disabled={loadingMore}
            className="px-4 py-2 rounded-full text-sm font-medium text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white disabled:opacity-50 transition-colors"
          >
            {loadingMore ? 'Loading…' : 'Load older'}
          </button>
        )}
      </div>

      <p className="text-xs text-slate-600">
        IP addresses are stored as salted hashes only. Exporting this log is itself recorded.
      </p>
    </div>
  );
}
