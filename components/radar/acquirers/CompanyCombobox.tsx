'use client';

import { useEffect, useState } from 'react';
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { inputCls } from '@/components/radar/asset/ui';

export interface CompanyLite {
  id: string;
  name: string;
  company_type: string | null;
  hq_country: string | null;
  deals_last_12mo: number | null;
}

/**
 * Headless combobox over /api/companies/search (name ilike, 2+ characters,
 * 150 ms debounce). Selection hands back the company row.
 */
export function CompanyCombobox({ value, onChange, placeholder = 'Search a company…', autoFocus = false }: { value: CompanyLite | null; onChange: (c: CompanyLite | null) => void; placeholder?: string; autoFocus?: boolean }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CompanyLite[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setOptions([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/companies/search?q=${encodeURIComponent(q)}&limit=12`, { signal: ctrl.signal });
        if (!res.ok) throw new Error('search failed');
        const data = (await res.json()) as { companies: CompanyLite[] };
        setOptions(data.companies ?? []);
      } catch {
        if (!ctrl.signal.aborted) setOptions([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  return (
    <Combobox value={value} onChange={onChange} by="id">
      <div className="relative">
        <ComboboxInput
          aria-label="Company"
          autoFocus={autoFocus}
          className={`${inputCls} pr-8`}
          displayValue={(c: CompanyLite | null) => c?.name ?? ''}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2" aria-label="Show companies">
          <ChevronUpDownIcon className="h-4 w-4 text-neutral-500" aria-hidden />
        </ComboboxButton>
        <ComboboxOptions
          anchor="bottom start"
          className="z-40 mt-1 w-[var(--input-width)] rounded-xl border border-neutral-200 bg-white p-1 shadow-lg focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 [--anchor-max-height:20rem]"
        >
          {loading && options.length === 0 && <div className="px-2.5 py-2 text-xs text-neutral-500">Searching…</div>}
          {!loading && query.trim().length >= 2 && options.length === 0 && <div className="px-2.5 py-2 text-xs text-neutral-500">No companies match</div>}
          {options.map(c => (
            <ComboboxOption key={c.id} value={c} className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-neutral-800 data-[focus]:bg-neutral-100 dark:text-neutral-200 dark:data-[focus]:bg-neutral-800">
              <span className="block truncate font-medium">{c.name}</span>
              <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                {[c.company_type?.replace(/_/g, ' '), c.hq_country, c.deals_last_12mo ? `${c.deals_last_12mo} deals / 12 mo` : null].filter(Boolean).join(' · ')}
              </span>
            </ComboboxOption>
          ))}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
