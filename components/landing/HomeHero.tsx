// Server component. The hero is in the HTML, animates with CSS from first paint,
// and carries no client state; the two interactive bits are tiny islands.
import HeroProductPreview from '@/components/landing/HeroProductPreview';
import CalculatorCta from '@/components/landing/CalculatorCta';
import DashboardLink from '@/components/landing/DashboardLink';

export default function HomeHero({ dealCount }: { dealCount: string }) {
  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-white dark:bg-slate-900 pt-28 sm:pt-32 lg:pt-40 xl:pt-44 pb-14 sm:pb-24 lg:pb-28 px-4 xl:px-6 overflow-hidden lg:min-h-[85vh] flex items-center transition-colors duration-300">
        {/* Clean background — single subtle gradient */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(14,165,165,0.08),transparent)]" />
        </div>

        <div className="relative max-w-7xl mx-auto w-full lg:flex lg:items-center lg:gap-16 xl:gap-20">
          <div className="text-center lg:text-left lg:flex-1">

          {/* Product eyebrow */}
          <div className="flex items-center gap-2 mb-6 justify-center lg:justify-start animate-rise">
            <span className="text-sm font-semibold tracking-wide text-slate-900 dark:text-white">Solidus</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-sm text-slate-400 dark:text-slate-500">The gold standard for deal intelligence</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-[64px] xl:text-7xl font-bold font-display mb-6 lg:mb-8 tracking-tight leading-[1.08] animate-rise animate-rise-d1">
            <span className="text-slate-900 dark:text-white">Know what your</span>
            <br />
            <span className="text-slate-900 dark:text-white">deal is </span>
            <span className="bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">worth</span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-xl lg:max-w-lg mx-auto lg:mx-0 mb-8 lg:mb-12 leading-relaxed animate-rise animate-rise-d2">
            Stop guessing on upfronts, milestones, and royalties.
            {' '}Solidus benchmarks your deal against <span className="font-semibold text-slate-700 dark:text-slate-200">{dealCount} primary-sourced transactions</span> — in seconds.
          </p>

          {/* Single clear CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-8 sm:mb-12 animate-rise animate-rise-d3">
            <CalculatorCta />

            <DashboardLink />
          </div>

          {/* Social proof — what, not features */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 max-w-xs mx-auto sm:max-w-none sm:flex sm:flex-wrap sm:items-center sm:justify-center lg:justify-start sm:gap-x-6 text-sm text-slate-500 dark:text-slate-400 animate-rise animate-rise-d4">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {dealCount} primary-sourced deals
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Results in 30 seconds
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Free to start
            </span>
          </div>
          </div>

          {/* Product Preview */}
          <HeroProductPreview />
        </div>
      </section>

    </>
  );
}
