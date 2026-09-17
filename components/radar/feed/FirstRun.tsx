'use client';

import { BuildingLibraryIcon } from '@heroicons/react/24/outline';
import type { RadarFilterState } from '@/lib/radar/client/filter-schema';
import type { MandateFields } from '@/lib/radar/client/mandate';
import { MandateForm } from './MandateForm';
import { BTN_SECONDARY, PANEL, cn } from './ui';

interface Props {
  saving: boolean;
  error: string | null;
  onSave: (fields: MandateFields, filters: RadarFilterState) => Promise<void>;
  onBrowseAll: () => void;
}

/** First visit with no saved mandate: build one, or skip to the full universe. */
export function FirstRun({ saving, error, onSave, onBrowseAll }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">What are you looking for?</h1>
        <p className="mt-2 max-w-xl text-sm text-neutral-600 dark:text-neutral-400">
          Describe the mandate once. The feed becomes that mandate&rsquo;s ranked matches, new matches are flagged as they
          appear, and you can keep as many mandates as you run searches.
        </p>
      </div>
      <div className={cn(PANEL, 'p-5 sm:p-6')}>
        <MandateForm saving={saving} error={error} onSubmit={onSave} submitLabel="Save mandate and open feed" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <p className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
          <BuildingLibraryIcon className="h-4 w-4" aria-hidden />
          Not ready to commit to a mandate?
        </p>
        <button type="button" onClick={onBrowseAll} className={BTN_SECONDARY}>
          Browse all assets
        </button>
      </div>
    </div>
  );
}
