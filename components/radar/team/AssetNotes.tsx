'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { apiJson, btnPrimary, btnGhost, inputCls, Skeleton, ErrorState, EmptyState } from '@/components/radar/asset/ui';
import { fmtDateTime } from '@/components/radar/asset/format';

interface Note { id: string; note_text: string; note_type: string; created_at: string; author: string; is_mine: boolean }
const NOTE_TYPES = ['general', 'clinical', 'commercial', 'regulatory', 'competitive', 'risk'] as const;

/** Team-scoped notes (author + active teammates, per migration 101 RLS and the notes route). */
export function AssetNotes({ assetId, teamName }: { assetId: string; teamName: string | null }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [type, setType] = useState<(typeof NOTE_TYPES)[number]>('general');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiJson<{ notes: Note[] }>(`/api/radar/notes?asset_id=${assetId}`);
      setNotes(data.notes);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load notes'); } finally { setLoading(false); }
  }, [assetId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setError(null);
    try {
      const data = await apiJson<{ note: Note }>('/api/radar/notes', { method: 'POST', body: JSON.stringify({ asset_id: assetId, note_text: text.trim(), note_type: type }) });
      setNotes(n => [data.note, ...n]);
      setText('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save note'); } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await apiJson(`/api/radar/notes?id=${id}`, { method: 'DELETE' });
      setNotes(n => n.filter(x => x.id !== id));
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete note'); }
  };

  return (
    <div>
      <form onSubmit={submit} className="space-y-2" aria-label="Add a note">
        <label className="block">
          <span className="sr-only">Note text</span>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={2000} placeholder={teamName ? `Visible to you and ${teamName}` : 'Visible to you (join a team to share)'} className={inputCls} />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs text-neutral-600 dark:text-neutral-300">
            Type{' '}
            <select value={type} onChange={e => setType(e.target.value as (typeof NOTE_TYPES)[number])} className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs capitalize dark:border-neutral-700 dark:bg-neutral-900">
              {NOTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy || !text.trim()} className={btnPrimary}>Add note</button>
        </div>
      </form>
      {error && <div className="mt-2"><ErrorState message={error} onRetry={load} /></div>}
      <div className="mt-4">
        {loading ? <Skeleton lines={3} /> : notes.length === 0 ? (
          <EmptyState title="No notes yet" detail="Notes are scoped to you and your active team; they never appear in exports." />
        ) : (
          <ul className="space-y-3">
            {notes.map(n => (
              <li key={n.id} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{n.is_mine ? 'You' : n.author}</span>
                    <span className="ml-1.5 capitalize">{n.note_type}</span>
                    <span className="ml-1.5">{fmtDateTime(n.created_at)}</span>
                  </p>
                  {n.is_mine && (
                    <button type="button" onClick={() => remove(n.id)} className={btnGhost} aria-label="Delete note"><TrashIcon className="h-3.5 w-3.5" aria-hidden="true" /></button>
                  )}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200">{n.note_text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
