'use client';

import { useEffect, useRef, useState } from 'react';

const useCases = [
  {
    title: 'For Founders',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    bullets: [
      'Know your asset\'s market value with rNPV analysis and Monte Carlo simulation',
      'Present data-backed terms with AI-generated deal memos and negotiation playbooks',
      'Run sensitivity analysis and model scenario ranges before entering the room',
    ],
  },
  {
    title: 'For BD Teams',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    bullets: [
      'Screen opportunities with AI partner matching and company intelligence profiles',
      'Generate board-ready PDF reports, AI deal memos, and negotiation playbooks',
      'Track deal flow with Market Pulse dashboard and watchlist alerts',
    ],
  },
  {
    title: 'For Boards & Investors',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    bullets: [
      'Validate deal terms with rNPV models and benchmarks from 600+ deals across 120+ companies',
      'Review Monte Carlo probability distributions and scenario comparisons',
      'Monitor market trends with Market Pulse intelligence and deal alerts',
    ],
  },
  {
    title: 'For M&A Advisors',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    bullets: [
      'Accelerate due diligence with rNPV models, comparable deals, and company profiles',
      'Build data-driven negotiation strategies with AI playbooks and outreach templates',
      'Export branded PDF and Excel reports with full financial modeling for clients',
    ],
  },
];

export default function UseCaseCards() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-16 sm:py-20 lg:py-24 xl:py-28 px-4 xl:px-6 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-800/50 dark:to-slate-900 transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 sm:mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 bg-cyan-50 dark:bg-cyan-500/20 border border-cyan-200 dark:border-cyan-500/30 rounded-full px-4 py-1.5 mb-6">
            <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Built For You</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-navy-800 dark:text-white mb-3 sm:mb-4">
            Every Role, One Platform
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-neutral-600 dark:text-slate-400 max-w-2xl mx-auto">
            From early-stage founders to boardroom advisors, Ambrosia gives you the data edge in every deal conversation
          </p>
        </div>

        <div ref={sectionRef} className="grid sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 xl:gap-10">
          {useCases.map((useCase, idx) => (
            <div
              key={useCase.title}
              className={`group relative bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl
                         rounded-2xl border border-white/20 dark:border-slate-700/50
                         p-6 sm:p-8 xl:p-10 shadow-soft hover:shadow-soft-lg
                         motion-safe:transition-all motion-safe:duration-700
                         hover:-translate-y-2 hover:border-teal-200 dark:hover:border-teal-500/50
                         ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: isVisible ? `${idx * 150}ms` : '0ms' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-soft group-hover:scale-110 group-hover:shadow-glow transition-all duration-300">
                  {useCase.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                  {useCase.title}
                </h3>
              </div>
              <ul className="space-y-2.5">
                {useCase.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm sm:text-base text-neutral-600 dark:text-slate-400">
                    <svg className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
