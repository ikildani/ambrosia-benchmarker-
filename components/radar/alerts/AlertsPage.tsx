'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RadarPageFrame } from '@/components/radar/RadarPageFrame';
import { RadarSubNav } from '@/components/radar/RadarSubNav';
import { SectionCard, apiJson } from '@/components/radar/asset/ui';
import { AlertRuleForm } from './AlertRuleForm';
import { AlertInbox } from './AlertInbox';

interface MandateLite { id: string; name: string }

/**
 * /radar/alerts — the account-wide alert rules and the inbox of everything
 * that fired. Auth-only: in-app rules are the free-tier hook; email and
 * Slack channels need Pro (enforced by the API).
 */
export function AlertsPage({ hasProAccess }: { hasProAccess: boolean }) {
  const [mandates, setMandates] = useState<MandateLite[]>([]);
  useEffect(() => {
    if (!hasProAccess) return;
    apiJson<{ mandates: MandateLite[] }>('/api/radar/mandates')
      .then(d => setMandates(d.mandates.map(m => ({ id: m.id, name: m.name }))))
      .catch(() => undefined);
  }, [hasProAccess]);

  return (
    <RadarPageFrame>
      <main className="min-h-screen bg-neutral-50 pt-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 sm:pt-20">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <RadarSubNav current="alerts" />
          <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Alerts</h1>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
                Rules run once a day after scoring. Rules that name no asset watch everything on your{' '}
                <Link href="/radar/watchlist" className="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100">watchlist</Link>;
                mandate digests summarise new matches for a mandate.
              </p>
            </div>
          </header>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <SectionCard title="Rules">
              <AlertRuleForm mandates={mandates} />
            </SectionCard>
            <SectionCard title="Inbox">
              <AlertInbox />
            </SectionCard>
          </div>
        </div>
      </main>
    </RadarPageFrame>
  );
}
