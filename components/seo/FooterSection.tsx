'use client';

import { useState } from 'react';

/**
 * Footer column that is an accordion on phones and an open column from `md` up.
 * Rows are 44px tall so the 34 footer links stop being 16px targets 8px apart.
 */
export default function FooterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = `footer-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="border-b border-slate-800 md:border-0">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider md:mb-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden flex w-full items-center justify-between min-h-12 text-left"
        >
          {title}
          <svg className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <span className="hidden md:block">{title}</span>
      </h3>
      <ul id={id} className={`${open ? 'block pb-3' : 'hidden'} md:block`}>
        {children}
      </ul>
    </div>
  );
}
