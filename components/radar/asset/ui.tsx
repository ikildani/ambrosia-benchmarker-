'use client';

/**
 * Small institutional primitives shared by the brief islands. neutral-*
 * tokens, AA contrast in both themes, pill buttons, no emoji.
 */

import type { ReactNode } from 'react';

export function SectionCard({ id, title, meta, children, className = '' }: { id?: string; title: string; meta?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={`scroll-mt-32 rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/60 ${className}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 sm:px-5">
        <h2 id={id ? `${id}-title` : undefined} className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">{title}</h2>
        {meta && <div className="text-xs text-neutral-500 dark:text-neutral-400">{meta}</div>}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

export function Pill({ children, tone = 'neutral', title }: { children: ReactNode; tone?: 'neutral' | 'amber' | 'emerald' | 'rose' | 'sky'; title?: string }) {
  const tones: Record<string, string> = {
    neutral: 'border-neutral-300 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-200',
    amber: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200',
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-200',
    rose: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-700/60 dark:bg-rose-900/20 dark:text-rose-200',
    sky: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700/60 dark:bg-sky-900/20 dark:text-sky-200',
  };
  return <span title={title} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${tones[tone]}`}>{children}</span>;
}

export function KV({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className={`mt-0.5 text-sm text-neutral-900 dark:text-neutral-100 ${mono ? 'font-mono tabular-nums' : ''}`}>{children}</dd>
    </div>
  );
}

export const btnPrimary = 'inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white dark:focus-visible:ring-offset-neutral-950';
export const btnSecondary = 'inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3.5 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:focus-visible:ring-offset-neutral-950';
export const btnGhost = 'inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-neutral-200 dark:hover:bg-neutral-800';
export const inputCls = 'block w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100';

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-md border border-dashed border-neutral-300 px-4 py-6 text-center dark:border-neutral-700">
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{title}</p>
      {detail && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{detail}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-200">
      <span>{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className={btnGhost}>Retry</button>}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse motion-reduce:animate-none space-y-2" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 rounded bg-neutral-200 dark:bg-neutral-800" style={{ width: `${90 - (i % 3) * 15}%` }} />
      ))}
    </div>
  );
}

export function ExternalLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`text-amber-700 underline decoration-amber-700/40 underline-offset-2 hover:decoration-amber-700 dark:text-amber-400 dark:decoration-amber-400/40 dark:hover:decoration-amber-400 ${className}`}>
      {children}
    </a>
  );
}

export function scoreTone(score: number): 'emerald' | 'amber' | 'neutral' {
  if (score >= 70) return 'emerald';
  if (score >= 40) return 'amber';
  return 'neutral';
}

export async function apiJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  return body as T;
}
