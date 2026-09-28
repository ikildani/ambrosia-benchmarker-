'use client';

/**
 * Section navigation shared by every Search & Evaluation surface: Feed,
 * Watchlist, Alerts, Acquirers, Methodology. The active item comes from the
 * pathname (or an explicit `current` for pages whose path is nested, like
 * /radar/mandates/[id], which belongs to the feed).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type RadarSection = 'feed' | 'watchlist' | 'alerts' | 'acquirers' | 'methodology';

export const RADAR_SECTIONS: ReadonlyArray<{ key: RadarSection; label: string; href: string }> = [
  { key: 'feed', label: 'Feed', href: '/radar' },
  { key: 'watchlist', label: 'Watchlist', href: '/radar/watchlist' },
  { key: 'alerts', label: 'Alerts', href: '/radar/alerts' },
  { key: 'acquirers', label: 'Acquirers', href: '/radar/acquirers' },
  { key: 'methodology', label: 'Methodology', href: '/radar/methodology' },
];

/** Which section a Radar pathname belongs to. Asset briefs and mandate pages sit under the feed. */
export function sectionForPath(pathname: string | null | undefined): RadarSection {
  const p = (pathname || '').replace(/\/+$/, '');
  if (p.startsWith('/radar/watchlist')) return 'watchlist';
  if (p.startsWith('/radar/alerts')) return 'alerts';
  if (p.startsWith('/radar/acquirers')) return 'acquirers';
  if (p.startsWith('/radar/methodology')) return 'methodology';
  return 'feed';
}

export function RadarSubNav({ current, className = '' }: { current?: RadarSection; className?: string }) {
  const pathname = usePathname();
  const active = current ?? sectionForPath(pathname);
  return (
    <nav aria-label="Search & Evaluation sections" className={`-mx-1 flex gap-1 overflow-x-auto ${className}`}>
      {RADAR_SECTIONS.map(s => {
        const isActive = s.key === active;
        return (
          <Link
            key={s.key}
            href={s.href}
            aria-current={isActive ? 'page' : undefined}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              isActive
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
