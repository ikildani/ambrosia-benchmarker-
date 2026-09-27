'use client';

import { useState } from 'react';
import { BuildingLibraryIcon } from '@heroicons/react/24/outline';
import type { RadarFilterState } from '@/lib/radar/client/filter-schema';
import type { MandateFields } from '@/lib/radar/client/mandate';
import { MANDATE_TEMPLATES, type MandateTemplate } from '@/lib/radar/client/mandate-templates';
import { MandateForm } from './MandateForm';
import { BTN_SECONDARY, PANEL, Pill, SectionLabel, cn } from './ui';

interface Props {
  saving: boolean;
  error: string | null;
  onSave: (fields: MandateFields, filters: RadarFilterState) => Promise<void>;
  onBrowseAll: () => void;
}

/** First visit with no saved mandate: build one, or skip to the full universe. */
export function FirstRun({ saving, error, onSave, onBrowseAll }: Props) {
  const [template, setTemplate] = useState<MandateTemplate | null>(null);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">What are you looking for?</h1>
        <p className="mt-2 max-w-xl text-sm text-neutral-600 dark:text-neutral-400">
          Describe the mandate once. The feed becomes that mandate&rsquo;s ranked matches, new matches are flagged as they
          appear, and you can keep as many mandates as you run searches.
        </p>
      </div>
      <div className="mb-4">
        <SectionLabel>Start from a template</SectionLabel>
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Mandate templates">
          {MANDATE_TEMPLATES.map(t => (
            <Pill key={t.id} size="sm" active={template?.id === t.id} onClick={() => setTemplate(template?.id === t.id ? null : t)} title={t.audience}>
              {t.name}
            </Pill>
          ))}
        </div>
        {template && <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400">{template.description} Adjust anything below before saving.</p>}
      </div>
      <div className={cn(PANEL, 'p-5 sm:p-6')}>
        <MandateForm
          key={template?.id ?? 'blank'}
          initial={template?.filters}
          initialName={template?.name}
          initialDescription={template?.description ?? null}
          saving={saving}
          error={error}
          onSubmit={onSave}
          submitLabel="Save mandate and open feed"
        />
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
