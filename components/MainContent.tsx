'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Calculator from './Calculator';
import Pricing from './Pricing';

export default function MainContent() {
  const [tier, setTier] = useState<'free' | 'pro'>('free');

  // Check for successful Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setTier('pro');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-hero text-white pt-32 pb-24 px-4 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
          <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-brand-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-brand-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-2 mb-8">
            <div className="w-2 h-2 bg-success-400 rounded-full animate-pulse-slow" />
            <span className="text-sm font-medium text-white/90">Free Tool by Ambrosia Ventures</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 tracking-tight">
            Life Sciences
            <br />
            <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
              Deal Calculator
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl sm:text-2xl text-neutral-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            Get data-driven estimates for upfront payments, milestones, and royalties
            for your oncology asset licensing or M&A transaction
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a
              href="#calculator"
              className="inline-flex items-center gap-2 bg-white text-neutral-900 font-semibold px-8 py-4 rounded-xl
                       shadow-soft-xl hover:shadow-soft-xl transition-all duration-200 hover:-translate-y-0.5"
            >
              <span>Try Calculator Free</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold px-8 py-4 rounded-xl
                       hover:bg-white/20 transition-all duration-200"
            >
              <span>View Pricing</span>
            </a>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Based on public deal data' },
              { icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z', text: 'All oncology modalities' },
              { icon: 'M13 10V3L4 14h7v7l9-11h-7z', text: 'Instant results' },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-5 py-2.5">
                <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                </svg>
                <span className="text-sm font-medium text-white/80">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Gradient Fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-neutral-50 to-transparent" />
      </section>

      {/* Calculator Section */}
      <section className="py-16 px-4 bg-neutral-50 -mt-16">
        <Calculator tier={tier} onUpgrade={scrollToPricing} />
      </section>

      {/* Pricing Section */}
      <Pricing currentTier={tier} onSelectTier={setTier} />

      {/* Features Section */}
      <section className="py-24 px-4 bg-neutral-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-full px-4 py-1.5 mb-6">
              <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm font-medium text-brand-700">Why Use This Tool</span>
            </div>
            <h2 className="text-4xl font-bold text-neutral-900 mb-4">
              Built for Life Sciences Professionals
            </h2>
            <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
              Whether you&apos;re a biotech founder, BD executive, or investor, get instant benchmarks for your deals
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                title: 'Data-Driven Benchmarks',
                description: 'Estimates based on publicly available deal terms from SEC filings, press releases, and industry reports.',
              },
              {
                icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
                title: 'Customizable Analysis',
                description: 'Adjust for development phase, modality, indication type, and competitive positioning for relevant estimates.',
              },
              {
                icon: 'M13 10V3L4 14h7v7l9-11h-7z',
                title: 'Instant Results',
                description: 'Get immediate estimates for upfront payments, development milestones, regulatory milestones, and royalties.',
              },
            ].map((feature, idx) => (
              <div key={idx} className="group bg-white p-8 rounded-2xl border border-neutral-200 shadow-soft hover:shadow-soft-lg hover:border-neutral-300 transition-all duration-300">
                <div className="w-14 h-14 bg-brand-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-brand-100 transition-colors">
                  <svg className="w-7 h-7 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-neutral-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-4 bg-white scroll-mt-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-neutral-100 border border-neutral-200 rounded-full px-4 py-1.5 mb-6">
            <span className="text-sm font-medium text-neutral-700">About Us</span>
          </div>
          <h2 className="text-4xl font-bold text-neutral-900 mb-6">
            Ambrosia Ventures
          </h2>
          <p className="text-xl text-neutral-600 mb-10 leading-relaxed">
            A boutique strategy and M&A advisory firm specializing in life sciences.
            We help biotech companies, pharmaceutical corporate development teams, and investors
            navigate licensing deals, M&A transactions, and strategic partnerships.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {['Licensing Strategy', 'M&A Advisory', 'In/Out-Licensing', 'Deal Structuring', 'Valuation'].map((service, idx) => (
              <span key={idx} className="px-5 py-2.5 bg-neutral-50 rounded-xl text-neutral-700 text-sm font-medium border border-neutral-200">
                {service}
              </span>
            ))}
          </div>
          <a
            href="https://www.ambrosiaventures.co"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Visit Our Website
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-900 text-neutral-400 py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-8 pb-12 border-b border-neutral-800">
            <div className="flex items-center gap-4">
              <Image
                src="https://static.wixstatic.com/media/e2a242_df6cb9bedde343e3b97ab79426ee1402~mv2.jpg"
                alt="Ambrosia Ventures"
                width={140}
                height={38}
                className="h-9 w-auto object-contain brightness-0 invert opacity-80"
                unoptimized
              />
            </div>
            <nav className="flex items-center gap-8 text-sm">
              <a href="https://www.ambrosiaventures.co" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Website
              </a>
              <a href="mailto:info@ambrosiaventures.co" className="hover:text-white transition-colors">
                Contact
              </a>
              <a href="https://www.linkedin.com/company/ambrosia-ventures" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                LinkedIn
              </a>
              <a href="https://instagram.com/ambrosiaventures" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Instagram
              </a>
            </nav>
          </div>
          <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm">
              &copy; {new Date().getFullYear()} Ambrosia Ventures. All rights reserved.
            </p>
            <p className="text-xs text-neutral-500 max-w-md text-center md:text-right">
              This tool is for informational purposes only and does not constitute financial or legal advice.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
