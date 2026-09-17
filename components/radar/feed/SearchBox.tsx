'use client';

/**
 * One search box. Typing shows typeahead suggestions (assets, companies,
 * targets, indications). Enter with plain text applies it as the feed's
 * text filter; Enter with a sentence (three or more words) sends it to
 * /api/radar/search, which returns filter chips that are applied to the
 * same state. Nothing renders a separate results block.
 */

import { useEffect, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { MagnifyingGlassIcon, BeakerIcon, BuildingOffice2Icon, CursorArrowRaysIcon, TagIcon } from '@heroicons/react/20/solid';
import type { SearchSuggestion, SearchParseResponse } from '@/lib/radar/client/api-types';
import { useNaturalSearch, useTypeahead } from '@/lib/radar/client/hooks';
import { FOCUS_RING, Spinner, cn } from './ui';

interface Props {
  /** Current text filter from the URL, so back/forward keeps the box in sync. */
  value: string;
  onApplyText: (q: string) => void;
  onToggleTarget: (target: string) => void;
  onParsed: (res: SearchParseResponse) => void;
}

type Item = { kind: 'typed'; text: string } | { kind: 'suggestion'; suggestion: SearchSuggestion };

const ICONS: Record<SearchSuggestion['kind'], typeof BeakerIcon> = {
  asset: BeakerIcon,
  company: BuildingOffice2Icon,
  target: CursorArrowRaysIcon,
  indication: TagIcon,
};

const KIND_LABEL: Record<SearchSuggestion['kind'], string> = {
  asset: 'Asset',
  company: 'Company',
  target: 'Target',
  indication: 'Indication',
};

function looksLikeSentence(text: string): boolean {
  return text.trim().split(/\s+/).length >= 3;
}

export function SearchBox({ value, onApplyText, onToggleTarget, onParsed }: Props) {
  const router = useRouter();
  const [text, setText] = useState(value);
  const { suggestions, loading } = useTypeahead(text);
  const { parse, parsing, error } = useNaturalSearch();

  useEffect(() => {
    setText(value);
  }, [value]);

  const submitText = async (raw: string) => {
    const t = raw.trim();
    if (!t) {
      onApplyText('');
      return;
    }
    if (looksLikeSentence(t)) {
      const res = await parse(t);
      if (res) {
        onParsed(res);
        setText('');
      }
      return;
    }
    onApplyText(t);
  };

  const onSelect = (item: Item | null) => {
    if (!item) return;
    if (item.kind === 'typed') {
      void submitText(item.text);
      return;
    }
    const s = item.suggestion;
    switch (s.kind) {
      case 'asset':
        if (s.asset_id) router.push(`/radar/${s.asset_id}`);
        break;
      case 'target':
        onToggleTarget(s.label);
        setText('');
        break;
      case 'company':
      case 'indication':
        onApplyText(s.label);
        break;
      default:
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setText(value);
    }
  };

  const items: Item[] = text.trim() ? [{ kind: 'typed', text }, ...suggestions.map(s => ({ kind: 'suggestion' as const, suggestion: s }))] : [];

  return (
    <div className="relative w-full">
      <Combobox<Item | null> value={null} onChange={onSelect} immediate>
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden />
          <ComboboxInput
            aria-label="Search assets, companies, targets, or describe what you are looking for"
            placeholder="Search assets, companies, targets — or describe what you want, e.g. unpartnered Phase 2 ADCs in Europe"
            displayValue={() => text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            className={cn(
              'h-9 w-full rounded-full border border-neutral-300 bg-white pl-9 pr-9 text-sm text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500',
              FOCUS_RING,
            )}
          />
          {(loading || parsing) && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2" />}
        </div>
        {items.length > 0 && (
          <ComboboxOptions
            anchor="bottom start"
            className="z-40 mt-1 w-[var(--input-width)] overflow-hidden rounded-xl border border-neutral-200 bg-white p-1 shadow-lg focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 [--anchor-max-height:20rem]"
          >
            {items.map((item, i) => {
              if (item.kind === 'typed') {
                const sentence = looksLikeSentence(item.text);
                return (
                  <ComboboxOption
                    key="typed"
                    value={item}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-neutral-800 data-[focus]:bg-neutral-100 dark:text-neutral-200 dark:data-[focus]:bg-neutral-800"
                  >
                    <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
                    <span className="truncate">
                      {sentence ? 'Turn into filters: ' : 'Search for '}
                      <span className="font-medium">“{item.text}”</span>
                    </span>
                    <kbd className="ml-auto rounded border border-neutral-300 px-1 font-mono text-[11px] text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">Enter</kbd>
                  </ComboboxOption>
                );
              }
              const s = item.suggestion;
              const Icon = ICONS[s.kind];
              return (
                <ComboboxOption
                  key={`${s.kind}:${s.asset_id ?? s.label}:${i}`}
                  value={item}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-neutral-800 data-[focus]:bg-neutral-100 dark:text-neutral-200 dark:data-[focus]:bg-neutral-800"
                >
                  <Icon className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {s.label}
                    {s.detail && <span className="ml-1.5 text-xs text-neutral-600 dark:text-neutral-400">{s.detail}</span>}
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-neutral-500">{KIND_LABEL[s.kind]}</span>
                </ComboboxOption>
              );
            })}
          </ComboboxOptions>
        )}
      </Combobox>
      {error && (
        <p role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          {error}
        </p>
      )}
    </div>
  );
}
