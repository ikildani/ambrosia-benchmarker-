'use client';

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/20/solid';
import { radarLabel } from '@/lib/radar/vocab';
import type { RadarMandate } from '@/lib/radar/client/api-types';
import { mandateSummary } from '@/lib/radar/client/mandate';
import { BTN_GHOST, FOCUS_RING, cn } from './ui';

const ALL = '__all__';

interface Props {
  mandates: RadarMandate[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (m: RadarMandate) => void;
  onNew: () => void;
}

/** Mandate picker (Headless Listbox). "All assets" is always the first option. */
export function MandateSwitcher({ mandates, selectedId, onSelect, onEdit, onNew }: Props) {
  const selected = mandates.find(m => m.id === selectedId) ?? null;
  const value = selected ? selected.id : ALL;

  return (
    <div className="flex items-center gap-1">
      <Listbox value={value} onChange={v => onSelect(v === ALL ? null : v)}>
        <ListboxButton
          className={cn(
            'inline-flex h-9 max-w-[16rem] items-center gap-2 rounded-full border border-neutral-300 bg-white pl-3 pr-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800',
            FOCUS_RING,
          )}
          aria-label="Mandate"
        >
          <span className="truncate">{selected ? selected.name : 'All assets'}</span>
          {selected && (selected.unread_matches ?? 0) > 0 && (
            <span className="rounded-full bg-teal-600 px-1.5 text-[11px] font-semibold text-white" title="New matches since you last looked">
              {selected.unread_matches}
            </span>
          )}
          <ChevronUpDownIcon className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
        </ListboxButton>
        <ListboxOptions
          anchor="bottom start"
          className="z-40 mt-1 w-80 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 [--anchor-max-height:22rem]"
        >
          <ListboxOption value={ALL} className="group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-neutral-800 data-[focus]:bg-neutral-100 dark:text-neutral-200 dark:data-[focus]:bg-neutral-800">
            <CheckIcon className="h-4 w-4 shrink-0 text-teal-600 opacity-0 group-data-[selected]:opacity-100" aria-hidden />
            <span className="font-medium">All assets</span>
          </ListboxOption>
          {mandates.map(m => (
            <ListboxOption
              key={m.id}
              value={m.id}
              className="group flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-sm text-neutral-800 data-[focus]:bg-neutral-100 dark:text-neutral-200 dark:data-[focus]:bg-neutral-800"
            >
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 opacity-0 group-data-[selected]:opacity-100" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{m.name}</span>
                  {(m.unread_matches ?? 0) > 0 && (
                    <span className="rounded-full bg-teal-600 px-1.5 text-[11px] font-semibold text-white">{m.unread_matches} new</span>
                  )}
                </span>
                <span className="block truncate text-xs text-neutral-600 dark:text-neutral-400">{mandateSummary(m, radarLabel)}</span>
              </span>
            </ListboxOption>
          ))}
          <div className="mt-1 border-t border-neutral-200 pt-1 dark:border-neutral-800">
            <button type="button" onClick={onNew} className={cn(BTN_GHOST, 'w-full justify-start rounded-lg px-2.5 py-2 text-sm font-medium')}>
              <PlusIcon className="h-4 w-4" aria-hidden />
              New mandate
            </button>
          </div>
        </ListboxOptions>
      </Listbox>
      {selected && (
        <button type="button" onClick={() => onEdit(selected)} className={cn(BTN_GHOST, 'p-2')} aria-label={`Edit mandate ${selected.name}`} title="Edit mandate">
          <PencilSquareIcon className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
