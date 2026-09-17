'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookmarkIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import { apiJson, btnPrimary, btnSecondary, btnGhost, inputCls } from '@/components/radar/asset/ui';

interface WatchItem { id: string; asset_id: string; priority: 'high' | 'normal' | 'low'; tags: string[]; notes: string | null; score_at_add: number | null; team_id: string | null; is_mine: boolean; owner: string; score_change: number }
interface WatchlistResponse { watchlist: WatchItem[]; team: { id: string; name: string } | null }

/**
 * Watch / unwatch with inline priority, tags and a private watch note.
 * Reads the caller's row (scope=mine); when a teammate already watches the
 * asset that is surfaced as context, not as the caller's own state.
 */
export function WatchlistToggle({ assetId, onChange }: { assetId: string; onChange?: (watching: boolean) => void }) {
  const [item, setItem] = useState<WatchItem | null>(null);
  const [teamWatchers, setTeamWatchers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiJson<WatchlistResponse>('/api/radar/watchlist?scope=team');
      const rows = data.watchlist.filter(w => w.asset_id === assetId);
      const mine = rows.find(w => w.is_mine) ?? null;
      setItem(mine);
      setTeamWatchers(rows.filter(w => !w.is_mine).map(w => w.owner));
      setTags((mine?.tags ?? []).join(', '));
      setNotes(mine?.notes ?? '');
      onChange?.(!!mine);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load watchlist');
    } finally { setLoading(false); }
  }, [assetId, onChange]);

  useEffect(() => { void load(); }, [load]);

  const watch = async () => {
    setBusy(true); setError(null);
    try {
      await apiJson('/api/radar/watchlist', { method: 'POST', body: JSON.stringify({ asset_id: assetId }) });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };
  const unwatch = async () => {
    setBusy(true); setError(null);
    try {
      await apiJson(`/api/radar/watchlist?asset_id=${assetId}`, { method: 'DELETE' });
      setItem(null); setEditing(false); onChange?.(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };
  const setPriority = async (priority: WatchItem['priority']) => {
    if (!item) return;
    setBusy(true);
    try {
      await apiJson(`/api/radar/watchlist?asset_id=${assetId}`, { method: 'PATCH', body: JSON.stringify({ priority }) });
      setItem({ ...item, priority });
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };
  const saveDetails = async () => {
    if (!item) return;
    setBusy(true);
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);
      await apiJson(`/api/radar/watchlist?asset_id=${assetId}`, { method: 'PATCH', body: JSON.stringify({ tags: tagList, notes: notes.trim() || null }) });
      setItem({ ...item, tags: tagList, notes: notes.trim() || null });
      setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {item ? (
          <button type="button" onClick={unwatch} disabled={busy || loading} className={btnPrimary} aria-pressed="true">
            <BookmarkSolid className="h-4 w-4" aria-hidden="true" /> Watching
          </button>
        ) : (
          <button type="button" onClick={watch} disabled={busy || loading} className={btnSecondary} aria-pressed="false">
            <BookmarkIcon className="h-4 w-4" aria-hidden="true" /> Watch
          </button>
        )}
        {item && (
          <div role="group" aria-label="Priority" className="flex gap-1">
            {(['high', 'normal', 'low'] as const).map(p => (
              <button key={p} type="button" onClick={() => setPriority(p)} disabled={busy} aria-pressed={item.priority === p}
                className={`${btnGhost} capitalize ${item.priority === p ? 'bg-neutral-200 dark:bg-neutral-700' : ''}`}>{p}</button>
            ))}
          </div>
        )}
      </div>
      {teamWatchers.length > 0 && (
        <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">Also watched by {teamWatchers.join(', ')}.</p>
      )}
      {item && (
        <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
          {item.score_at_add != null && <span>Since watching: {item.score_change > 0 ? '+' : ''}{item.score_change} pts. </span>}
          {!editing ? (
            <>
              {item.tags.length > 0 && <span>Tags: {item.tags.join(', ')}. </span>}
              {item.notes && <span className="block mt-0.5 italic">{item.notes}</span>}
              <button type="button" onClick={() => setEditing(true)} className={`${btnGhost} mt-1`}>Edit tags and note</button>
            </>
          ) : (
            <div className="mt-2 space-y-2">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Tags (comma separated)</span>
                <input value={tags} onChange={e => setTags(e.target.value)} className={inputCls} maxLength={400} />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Watch note (private to you)</span>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} maxLength={2000} />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={saveDetails} disabled={busy} className={btnPrimary}>Save</button>
                <button type="button" onClick={() => setEditing(false)} className={btnSecondary}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-1.5 text-xs text-rose-700 dark:text-rose-400">{error}</p>}
    </div>
  );
}
