/**
 * Shared top navigation for the institutional-grade surfaces:
 *   /accuracy, /playbook, /trade-space, /simulator, /methodology/engine
 *
 * These pages all share the same dark theme and data-driven narrative.
 * This nav stitches them together so a visitor landing on one can
 * discover the others without bouncing back to the homepage.
 *
 * Kept deliberately slim (just text links, no logo / auth) — it sits
 * above page heroes as a sticky bar so the narrative cross-references
 * are always visible.
 */

import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
  shortLabel?: string;
}

const ITEMS: NavItem[] = [
  { href: '/playbook', label: 'Counterparty Playbooks', shortLabel: 'Playbooks' },
  { href: '/trade-space', label: 'Trade Space', shortLabel: 'Trade Space' },
  { href: '/simulator', label: 'Negotiation Simulator', shortLabel: 'Simulator' },
  { href: '/intelligence', label: 'Market Intelligence', shortLabel: 'Intel' },
  { href: '/methodology/engine', label: 'Methodology', shortLabel: 'Methodology' },
];

interface Props {
  /**
   * Path of the current page so the active item can get a highlight.
   * Pass from page.tsx via `usePathname()` or hard-coded (e.g. '/accuracy').
   */
  activePath?: string;
}

export function InstitutionalNav({ activePath }: Props) {
  return (
    <nav
      className="sticky top-16 sm:top-20 lg:top-24 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur"
      aria-label="Institutional intelligence navigation"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/"
          className="shrink-0 text-sm font-semibold tracking-tight text-slate-200 hover:text-slate-50"
        >
          Ambrosia<span className="text-slate-500"> · </span>
          <span className="font-normal text-slate-400">Intelligence</span>
        </Link>

        <ul className="flex items-center gap-1 overflow-x-auto text-sm sm:gap-2">
          {ITEMS.map((item) => {
            const isActive = activePath ? activePath.startsWith(item.href) : false;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={[
                    'rounded-md px-3 py-1.5 transition-colors',
                    isActive
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200',
                  ].join(' ')}
                >
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">{item.shortLabel ?? item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
