'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TabGroup, TabList, Tab, TabPanels, TabPanel, Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react';
import { AdjustmentsHorizontalIcon, XMarkIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { useReducedMotion } from 'framer-motion';
import Header from '@/components/Header';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import type { AssetBrief, BriefViewer } from './types';
import { AssetHeader } from './AssetHeader';
import { ScoreWaterfall } from './ScoreWaterfall';
import { PredictedTerms } from './PredictedTerms';
import { TrialsTable } from './TrialsTable';
import { Landscape } from './Landscape';
import { AnalystBrief } from './AnalystBrief';
import { AssetSidebar } from './AssetSidebar';
import { SectionCard, btnSecondary } from './ui';
import { AssetNotes } from '@/components/radar/team/AssetNotes';
import { ActivityFeed } from '@/components/radar/team/ActivityFeed';

const TABS = [
  { key: 'overview', label: 'Overview', sections: ['intent', 'terms'] },
  { key: 'trials', label: 'Trials', sections: ['trials'] },
  { key: 'landscape', label: 'Landscape', sections: ['landscape', 'acquirers'] },
  { key: 'brief', label: 'Analyst brief', sections: ['brief'] },
  { key: 'team', label: 'Team', sections: ['team'] },
] as const;

function tabIndexForHash(hash: string): number {
  const h = hash.replace('#', '');
  const i = TABS.findIndex(t => t.key === h || (t.sections as readonly string[]).includes(h));
  return i >= 0 ? i : 0;
}

/**
 * Client shell for /radar/[id]: fixed site header, asset header, sticky tab
 * bar (Headless UI, keyboard/aria complete), content column plus a desktop
 * sidebar; on mobile the sidebar becomes a bottom sheet. Tab selection is
 * mirrored to the URL hash so section deep-links (#terms, #brief) work and
 * the browser back button restores the tab.
 */
export function AssetBriefPage({ brief, viewer }: { brief: AssetBrief; viewer: BriefViewer }) {
  const auth = useAuth();
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const apply = () => setTab(tabIndexForHash(window.location.hash));
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  const onTabChange = (i: number) => {
    setTab(i);
    const key = TABS[i].key;
    if (window.location.hash !== `#${key}`) window.history.replaceState(null, '', `#${key}`);
  };

  const sidebar = useMemo(() => <AssetSidebar brief={brief} viewer={viewer} />, [brief, viewer]);

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Header
        isAuthenticated={auth.isAuthenticated}
        userName={auth.user?.name}
        userEmail={auth.user?.email}
        tier={auth.tier}
        isPortfolioAdmin={auth.isPortfolioAdmin}
        onSignInClick={() => auth.openAuthModal('signin')}
        onSignUpClick={() => auth.openAuthModal('signup')}
        onSignOut={auth.signOut}
      />
      <AuthModal isOpen={auth.showAuthModal} onClose={auth.closeAuthModal} onSuccess={(email, name) => auth.signIn(email, name)} initialMode={auth.authModalMode} />

      <a href="#brief-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-28 focus:z-[60] focus:rounded-md focus:bg-amber-500 focus:px-3 focus:py-2 focus:text-neutral-900">Skip to brief content</a>

      <main className="pt-16 sm:pt-20 lg:pt-24">
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          <nav aria-label="Breadcrumb" className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">
            <Link href="/radar" className="inline-flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100"><ChevronLeftIcon className="h-3.5 w-3.5" aria-hidden="true" /> Asset Radar</Link>
            <span className="mx-1.5" aria-hidden="true">/</span>
            <span className="text-neutral-700 dark:text-neutral-300">{brief.asset.asset_name}</span>
          </nav>

          <AssetHeader brief={brief} />

          <TabGroup selectedIndex={tab} onChange={onTabChange}>
            <div className="sticky top-16 z-30 -mx-4 border-b border-neutral-200 bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-neutral-800 dark:bg-neutral-950/95 dark:supports-[backdrop-filter]:bg-neutral-950/80 sm:top-20 sm:-mx-6 sm:px-6 lg:top-24 lg:-mx-8 lg:px-8">
              <TabList className="-mb-px flex gap-1 overflow-x-auto" aria-label="Brief sections">
                {TABS.map(t => (
                  <Tab key={t.key} as={Fragment}>
                    {({ selected }) => (
                      <button
                        type="button"
                        className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-0 ${selected ? 'border-amber-500 text-neutral-900 dark:text-neutral-50' : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'}`}
                      >
                        {t.label}
                      </button>
                    )}
                  </Tab>
                ))}
              </TabList>
            </div>

            <div id="brief-content" className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <TabPanels className="min-w-0 space-y-6">
                <TabPanel className="space-y-6 focus:outline-none" unmount={false}>
                  <ScoreWaterfall score={brief.score} trend={brief.trend} />
                  <PredictedTerms terms={brief.terms} asset={brief.asset} />
                </TabPanel>
                <TabPanel className="space-y-6 focus:outline-none" unmount={false}>
                  <TrialsTable trials={brief.trials} catalysts={brief.catalysts} />
                </TabPanel>
                <TabPanel className="space-y-6 focus:outline-none" unmount={false}>
                  <Landscape intel={brief.intel} acquirers={brief.acquirers} thesis={brief.terms.thesis} />
                </TabPanel>
                <TabPanel className="space-y-6 focus:outline-none">
                  <AnalystBrief assetId={brief.asset.id} />
                </TabPanel>
                <TabPanel className="space-y-6 focus:outline-none">
                  <SectionCard id="team" title="Notes" meta={viewer.team_name ? <span>Shared with {viewer.team_name}</span> : <span>Private to you</span>}>
                    <AssetNotes assetId={brief.asset.id} teamName={viewer.team_name} />
                  </SectionCard>
                  <SectionCard id="activity" title="Activity" meta={<span>Score moves and alerts for this asset</span>}>
                    <ActivityFeed assetId={brief.asset.id} scope={viewer.has_team ? 'team' : 'mine'} />
                  </SectionCard>
                </TabPanel>
              </TabPanels>

              <aside className="hidden lg:block" aria-label="Asset actions">
                <div className="sticky top-40 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  {sidebar}
                </div>
              </aside>
            </div>
          </TabGroup>
        </div>
      </main>

      {/* Mobile: actions bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 lg:hidden">
        <button type="button" onClick={() => setSheetOpen(true)} className={`${btnSecondary} w-full`} aria-haspopup="dialog" aria-expanded={sheetOpen}>
          <AdjustmentsHorizontalIcon className="h-4 w-4" aria-hidden="true" /> Watch, alerts and export
        </button>
      </div>
      <Dialog open={sheetOpen} onClose={() => setSheetOpen(false)} className="relative z-50 lg:hidden">
        <DialogBackdrop transition className={`fixed inset-0 bg-neutral-900/50 ${reduceMotion ? '' : 'transition duration-200 data-[closed]:opacity-0'}`} />
        <div className="fixed inset-0 flex items-end">
          <DialogPanel transition className={`max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border-t border-neutral-200 bg-white p-4 pb-8 shadow-xl dark:border-neutral-800 dark:bg-neutral-950 ${reduceMotion ? '' : 'transition duration-200 ease-out data-[closed]:translate-y-full'}`}>
            <div className="mb-3 flex items-center justify-between">
              <DialogTitle className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{brief.asset.asset_name}</DialogTitle>
              <button type="button" onClick={() => setSheetOpen(false)} className="rounded-full p-1.5 text-neutral-600 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-neutral-300 dark:hover:bg-neutral-800" aria-label="Close">
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {sheetOpen && sidebar}
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
