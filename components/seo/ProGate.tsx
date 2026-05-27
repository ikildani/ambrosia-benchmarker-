import Link from 'next/link';

export function ProGate({
  children,
  title = 'Full Analysis Available with Pro',
  description = 'See all comparable deals, milestone breakdowns, royalty structures, and negotiation insights.',
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  return (
    <div className="relative">
      {/* Blurred content preview */}
      <div className="max-h-[200px] overflow-hidden" aria-hidden="true">
        <div className="blur-[6px] select-none pointer-events-none opacity-60">
          {children}
        </div>
      </div>

      {/* Gradient fade */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950" />

      {/* CTA overlay */}
      <div className="relative -mt-4 rounded-xl border border-teal-500/20 bg-slate-900/95 backdrop-blur-sm p-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 border border-teal-500/20 rounded-full text-teal-400 text-xs font-semibold mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          PRO
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">{description}</p>
        <Link
          href="/pro"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold hover:from-teal-700 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/20"
        >
          Unlock Full Analysis — Start Pro Trial
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
        <p className="text-xs text-slate-500 mt-3">7-day money-back guarantee · Cancel anytime</p>
      </div>
    </div>
  );
}
