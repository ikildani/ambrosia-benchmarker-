'use client';

/**
 * Saved-view picker and save dialog. A view is the whole screen (filters,
 * search text, sort, table/cards, columns) under a name; private, or shared
 * with the team; one can be the default that opens on /radar.
 */

import { Fragment, useState, type FormEvent } from 'react';
import { Dialog, DialogPanel, DialogTitle, Menu, MenuButton, MenuItem, MenuItems, Transition, TransitionChild } from '@headlessui/react';
import { BookmarkIcon, CheckIcon, ChevronDownIcon, StarIcon, UsersIcon, XMarkIcon } from '@heroicons/react/20/solid';
import type { RadarSavedView } from '@/lib/radar/client/api-types';
import { usePrefersReducedMotion } from '@/lib/radar/client/hooks';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, FOCUS_RING, cn } from './ui';

interface SwitcherProps {
  views: RadarSavedView[];
  selectedId: string | null;
  /** The current screen differs from the selected view (so "Update" makes sense). */
  dirty: boolean;
  saving: boolean;
  onSelect: (view: RadarSavedView | null) => void;
  onSaveNew: () => void;
  onUpdate: (view: RadarSavedView) => void;
  onSetDefault: (view: RadarSavedView, isDefault: boolean) => void;
  onDelete: (view: RadarSavedView) => void;
}

const ITEM = 'group flex w-full cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-neutral-800 data-[focus]:bg-neutral-100 dark:text-neutral-200 dark:data-[focus]:bg-neutral-800';

export function ViewSwitcher({ views, selectedId, dirty, saving, onSelect, onSaveNew, onUpdate, onSetDefault, onDelete }: SwitcherProps) {
  const selected = views.find(v => v.id === selectedId) ?? null;
  const mine = views.filter(v => v.is_mine);
  const shared = views.filter(v => !v.is_mine);

  return (
    <Menu as="div" className="relative">
      <MenuButton
        className={cn(
          'inline-flex h-9 max-w-[16rem] items-center gap-2 rounded-full border border-neutral-300 bg-white pl-3 pr-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800',
          FOCUS_RING,
        )}
        aria-label="Saved views"
      >
        <BookmarkIcon className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
        <span className="truncate">{selected ? selected.name : 'Views'}</span>
        {selected && dirty && <span className="text-[11px] font-normal text-amber-700 dark:text-amber-300">edited</span>}
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
      </MenuButton>
      <MenuItems anchor="bottom start" className="z-40 mt-1 w-80 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 [--anchor-max-height:26rem]">
        {selected && (
          <div className="mb-1 border-b border-neutral-200 pb-1 dark:border-neutral-800">
            {selected.is_mine && (
              <MenuItem>
                <button type="button" onClick={() => onUpdate(selected)} className={ITEM} disabled={saving || !dirty}>
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">Update “{selected.name}”</span>
                    <span className="block text-xs text-neutral-600 dark:text-neutral-400">{dirty ? 'Save the current filters, sort and columns into it' : 'Nothing changed since you opened it'}</span>
                  </span>
                </button>
              </MenuItem>
            )}
            {selected.is_mine && (
              <MenuItem>
                <button type="button" onClick={() => onSetDefault(selected, !selected.is_default)} className={ITEM} disabled={saving}>
                  <StarIcon className={cn('mt-0.5 h-4 w-4 shrink-0', selected.is_default ? 'text-amber-500' : 'text-neutral-400')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{selected.is_default ? 'Stop opening this by default' : 'Open this view by default'}</span>
                  </span>
                </button>
              </MenuItem>
            )}
            <MenuItem>
              <button type="button" onClick={() => onSelect(null)} className={ITEM}>
                <XMarkIcon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                <span className="block font-medium">Leave this view</span>
              </button>
            </MenuItem>
          </div>
        )}
        <MenuItem>
          <button type="button" onClick={onSaveNew} className={ITEM}>
            <BookmarkIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
            <span className="block font-medium">Save current view as…</span>
          </button>
        </MenuItem>
        {mine.length > 0 && (
          <>
            <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">My views</p>
            {mine.map(v => (
              <ViewRow key={v.id} view={v} active={v.id === selectedId} onSelect={onSelect} onDelete={onDelete} />
            ))}
          </>
        )}
        {shared.length > 0 && (
          <>
            <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Shared with the team</p>
            {shared.map(v => (
              <ViewRow key={v.id} view={v} active={v.id === selectedId} onSelect={onSelect} />
            ))}
          </>
        )}
        {views.length === 0 && (
          <p className="px-2.5 py-2 text-xs text-neutral-600 dark:text-neutral-400">
            No saved views yet. Set the filters, sort and columns you want, then save them under a name. Views can be shared with your team and one can open by default.
          </p>
        )}
      </MenuItems>
    </Menu>
  );
}

function ViewRow({ view, active, onSelect, onDelete }: { view: RadarSavedView; active: boolean; onSelect: (v: RadarSavedView) => void; onDelete?: (v: RadarSavedView) => void }) {
  return (
    <MenuItem>
      <div className={cn(ITEM, 'items-center')}>
        <button type="button" onClick={() => onSelect(view)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
          <CheckIcon className={cn('mt-0.5 h-4 w-4 shrink-0 text-teal-600', active ? 'opacity-100' : 'opacity-0')} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-medium">{view.name}</span>
              {view.is_default && <StarIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Default view" />}
              {view.team_id && <UsersIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-label="Shared with the team" />}
            </span>
            {view.description && <span className="block truncate text-xs text-neutral-600 dark:text-neutral-400">{view.description}</span>}
          </span>
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onDelete(view);
            }}
            className={cn(BTN_GHOST, 'p-1 opacity-0 group-hover:opacity-100 group-data-[focus]:opacity-100')}
            aria-label={`Delete view ${view.name}`}
            title="Delete"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </MenuItem>
  );
}

// ── Save dialog ───────────────────────────────────────────────────────────

export interface SaveViewInput {
  name: string;
  description: string | null;
  shared: boolean;
  is_default: boolean;
}

interface DialogProps {
  open: boolean;
  canShare: boolean;
  saving: boolean;
  error: string | null;
  /** What the view will contain, for the summary line. */
  summary: string;
  onClose: () => void;
  onSave: (input: SaveViewInput) => Promise<void>;
}

export function SaveViewDialog({ open, canShare, saving, error, summary, onClose, onSave }: DialogProps) {
  const reduced = usePrefersReducedMotion();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shared, setShared] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give the view a name');
      return;
    }
    setNameError(null);
    await onSave({ name: trimmed, description: description.trim() || null, shared: canShare && shared, is_default: isDefault });
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild as={Fragment} enter={reduced ? 'duration-0' : 'ease-out duration-200'} enterFrom="opacity-0" enterTo="opacity-100" leave={reduced ? 'duration-0' : 'ease-in duration-150'} leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-neutral-950/50" aria-hidden />
        </TransitionChild>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center sm:items-center sm:p-6">
            <TransitionChild as={Fragment} enter={reduced ? 'duration-0' : 'ease-out duration-200'} enterFrom="translate-y-4 opacity-0" enterTo="translate-y-0 opacity-100" leave={reduced ? 'duration-0' : 'ease-in duration-150'} leaveFrom="translate-y-0 opacity-100" leaveTo="translate-y-4 opacity-0">
              <DialogPanel className="w-full max-w-md rounded-t-2xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 sm:rounded-2xl sm:p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="text-base font-semibold">Save this view</DialogTitle>
                    <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">{summary}</p>
                  </div>
                  <button type="button" onClick={onClose} aria-label="Close" className={cn(BTN_GHOST, 'p-1.5')}>
                    <XMarkIcon className="h-5 w-5" aria-hidden />
                  </button>
                </div>
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label htmlFor="view-name" className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Name</label>
                    <input
                      id="view-name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      maxLength={80}
                      autoFocus
                      placeholder="e.g. Oncology P2 unpartnered, EU originators"
                      className={cn('mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950', FOCUS_RING)}
                      aria-invalid={!!nameError}
                    />
                    {nameError && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{nameError}</p>}
                  </div>
                  <div>
                    <label htmlFor="view-description" className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Note (optional)</label>
                    <input
                      id="view-description"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      maxLength={500}
                      placeholder="Why this view exists"
                      className={cn('mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950', FOCUS_RING)}
                    />
                  </div>
                  <div className="space-y-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="h-4 w-4 rounded border-neutral-400 text-teal-600 dark:border-neutral-600 dark:bg-neutral-900" />
                      Open this view by default
                    </label>
                    <label className={cn('flex items-center gap-2', !canShare && 'text-neutral-500 dark:text-neutral-400')}>
                      <input type="checkbox" checked={shared} disabled={!canShare} onChange={e => setShared(e.target.checked)} className="h-4 w-4 rounded border-neutral-400 text-teal-600 dark:border-neutral-600 dark:bg-neutral-900" />
                      Share with my team{!canShare && ' (Portfolio plan)'}
                    </label>
                  </div>
                  {error && <p className="text-xs text-amber-700 dark:text-amber-300">{error}</p>}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY} disabled={saving}>{saving ? 'Saving' : 'Save view'}</button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
