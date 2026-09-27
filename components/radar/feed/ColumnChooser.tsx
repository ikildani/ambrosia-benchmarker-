'use client';

/**
 * Column chooser for the table view: a popover of checkboxes over
 * TABLE_COLUMNS. Always-on columns are shown disabled. Changes go to the URL
 * (so a shared link carries them) and, via the shell, to localStorage as the
 * viewer's default.
 */

import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { ViewColumnsIcon } from '@heroicons/react/20/solid';
import { DEFAULT_TABLE_COLUMNS, TABLE_COLUMNS, cleanColumns, sameColumns } from '@/lib/radar/client/filter-schema';
import { BTN_GHOST, BTN_SECONDARY, FOCUS_RING, cn } from './ui';

interface Props {
  columns: string[];
  onChange: (columns: string[]) => void;
}

export function ColumnChooser({ columns, onChange }: Props) {
  const isDefault = sameColumns(columns, DEFAULT_TABLE_COLUMNS);
  const toggle = (key: string) => {
    const next = columns.includes(key) ? columns.filter(k => k !== key) : [...columns, key];
    onChange(cleanColumns(next));
  };
  const optional = TABLE_COLUMNS.filter(c => !c.always);
  return (
    <Popover className="relative">
      <PopoverButton className={cn(BTN_SECONDARY, 'px-3 py-1.5')} aria-label="Choose columns">
        <ViewColumnsIcon className="h-4 w-4" aria-hidden />
        Columns{isDefault ? '' : ` (${columns.length})`}
      </PopoverButton>
      <PopoverPanel anchor="bottom end" className="z-40 mt-1 w-72 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg focus:outline-none dark:border-neutral-800 dark:bg-neutral-900">
        <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Table columns</p>
        <ul className="max-h-80 overflow-y-auto">
          {optional.map(c => {
            const on = columns.includes(c.key);
            return (
              <li key={c.key}>
                <label className={cn('flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800', FOCUS_RING)}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(c.key)}
                    className="mt-0.5 h-4 w-4 rounded border-neutral-400 text-teal-600 dark:border-neutral-600 dark:bg-neutral-900"
                  />
                  <span className="min-w-0">
                    <span className="block text-neutral-900 dark:text-neutral-100">{c.label}</span>
                    {c.hint && <span className="block text-xs text-neutral-500 dark:text-neutral-400">{c.hint}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="mt-1 flex items-center justify-between border-t border-neutral-200 px-1 pt-1.5 dark:border-neutral-800">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Score, asset and compare stay on</span>
          <button type="button" onClick={() => onChange([...DEFAULT_TABLE_COLUMNS])} className={cn(BTN_GHOST, 'px-2 py-1 text-xs')} disabled={isDefault}>
            Reset
          </button>
        </div>
      </PopoverPanel>
    </Popover>
  );
}
