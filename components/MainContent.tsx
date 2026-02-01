'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Calculator from './Calculator';
import Pricing from './Pricing';
import Header from './Header';

export default function MainContent() {
  const [tier, setTier] = useState<'free' | 'pro'>('free');
  const [isVisible, setIsVisible] = useState(false);

  // Check for successful Stripe checkout and saved tier
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setTier('pro');
      localStorage.setItem('user_tier', 'pro');
      window.history.replaceState({}, '', window.location.pathname);
    }

    const savedTier = localStorage.getItem('user_tier');
    if (savedTier === 'pro') {
      setTier('pro');
    }

    setIsVisible(true);
  }, []);

  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTierChange = (newTier: 'free' | 'pro') => {
    setTier(newTier);
    if (newTier === 'pro') {
      localStorage.setItem('user_tier', 'pro');
    } else {
      localStorage.removeItem('user_tier');
    }
  };

  return (
    <>
      {/* Header */}
      <Header />

      {/* Hero Section - World-Class Light Design */}
      <section className="relative bg-gradient-to-b from-white via-slate-50/50 to-teal-50/30 pt-36 lg:pt-44 pb-20 px-4 overflow-hidden min-h-[88vh] flex items-center">
        {/* Premium Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Elegant mesh gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,199,199,0.12),rgba(255,255,255,0))]" />

          {/* Floating orbs */}
          <div className="absolute top-20 right-[10%] w-72 h-72 bg-teal-200/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 left-[5%] w-96 h-96 bg-cyan-100/40 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-[20%] w-64 h-64 bg-navy-100/20 rounded-full blur-3xl" />

          {/* Subtle dot pattern */}
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #1a1e42 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>

        <div className={`relative max-w-5xl mx-auto text-center w-full transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Life Sciences Icon - DNA + Analytics */}
          <div className="mb-12 animate-fade-in">
            <div className="relative inline-flex">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-3xl blur-2xl opacity-30 scale-125" />
              {/* Icon container */}
              <div className="relative inline-flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl shadow-2xl border border-slate-700/50">
                {/* DNA Helix + Chart Icon */}
                <svg className="w-12 h-12 sm:w-14 sm:h-14" viewBox="0 0 48 48" fill="none">
                  {/* DNA Helix */}
                  <path d="M14 8C14 8 18 12 24 12C30 12 34 8 34 8" stroke="url(#dnaGradient)" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M14 16C14 16 18 20 24 20C30 20 34 16 34 16" stroke="url(#dnaGradient)" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M14 24C14 24 18 28 24 28C30 28 34 24 34 24" stroke="url(#dnaGradient)" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Vertical lines */}
                  <path d="M14 8V24" stroke="url(#dnaGradient)" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M34 8V24" stroke="url(#dnaGradient)" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Chart bars */}
                  <rect x="16" y="32" width="4" height="8" rx="1" fill="url(#chartGradient)"/>
                  <rect x="22" y="28" width="4" height="12" rx="1" fill="url(#chartGradient)"/>
                  <rect x="28" y="30" width="4" height="10" rx="1" fill="url(#chartGradient)"/>
                  {/* Gradients */}
                  <defs>
                    <linearGradient id="dnaGradient" x1="14" y1="8" x2="34" y2="24" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#2dd4bf"/>
                      <stop offset="1" stopColor="#06b6d4"/>
                    </linearGradient>
                    <linearGradient id="chartGradient" x1="16" y1="28" x2="32" y2="40" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#14b8a6"/>
                      <stop offset="1" stopColor="#0891b2"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>

          {/* Premium Headline */}
          <h1 className={`text-5xl sm:text-6xl lg:text-7xl font-bold mb-8 tracking-tight transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <span className="text-slate-900">Deal Terms</span>
            <br />
            <span className="bg-gradient-to-r from-teal-600 via-cyan-500 to-teal-400 bg-clip-text text-transparent drop-shadow-sm">
              Calculator
            </span>
          </h1>

          {/* Premium Subheadline */}
          <p className={`text-lg sm:text-xl lg:text-2xl text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed font-light transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            Data-driven estimates for upfront payments, milestones, and royalties
            <span className="hidden sm:inline"><br /></span>
            <span className="sm:hidden"> </span>
            for oncology licensing and M&A transactions
          </p>

          {/* Premium CTA Buttons */}
          <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 transition-all duration-700 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <a
              href="#calculator"
              className="group relative inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold px-8 py-4 rounded-2xl
                       shadow-xl shadow-teal-500/20 hover:shadow-2xl hover:shadow-teal-500/30 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              <span className="relative z-10">Try Calculator Free</span>
              <svg className="relative z-10 w-5 h-5 transition-transform duration-300 group-hover:translate-y-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </a>
            <a
              href="#pricing"
              className="group inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border-2 border-slate-200 text-slate-700 font-semibold px-8 py-4 rounded-2xl
                       shadow-lg shadow-slate-200/50 hover:border-teal-300 hover:text-teal-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
            >
              <span>View Pricing</span>
              <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>

          {/* Premium Feature Pills */}
          <div className={`flex flex-wrap justify-center gap-3 sm:gap-4 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {[
              { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Public deal data' },
              { icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z', text: 'All modalities' },
              { icon: 'M13 10V3L4 14h7v7l9-11h-7z', text: 'Instant results' },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="group flex items-center gap-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-full px-5 py-3
                         hover:bg-white hover:border-teal-200 hover:shadow-lg hover:shadow-teal-500/5 transition-all duration-300"
              >
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-50 group-hover:bg-teal-100 transition-colors">
                  <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={feature.icon} />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800 transition-colors">{feature.text}</span>
              </div>
            ))}
          </div>

          {/* Elegant Scroll indicator */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:block">
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <span className="text-xs font-medium tracking-wider uppercase">Scroll</span>
              <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
        </div>

        {/* Seamless Bottom Fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-slate-50 to-transparent" />
      </section>

      {/* Calculator Section */}
      <section id="calculator" className="py-20 px-4 bg-gradient-to-b from-slate-50 to-white -mt-20">
        <Calculator tier={tier} onUpgrade={scrollToPricing} />
      </section>

      {/* Pricing Section */}
      <Pricing currentTier={tier} onSelectTier={handleTierChange} />

      {/* Features Section */}
      <section className="py-24 px-4 bg-neutral-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5 mb-6">
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm font-medium text-teal-700">Why Use This Tool</span>
            </div>
            <h2 className="text-4xl font-bold text-navy-800 mb-4">
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
                gradient: 'from-teal-500 to-cyan-500',
              },
              {
                icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
                title: 'Customizable Analysis',
                description: 'Adjust for development phase, modality, indication type, and competitive positioning for relevant estimates.',
                gradient: 'from-cyan-500 to-teal-500',
              },
              {
                icon: 'M13 10V3L4 14h7v7l9-11h-7z',
                title: 'Instant Results',
                description: 'Get immediate estimates for upfront payments, development milestones, regulatory milestones, and royalties.',
                gradient: 'from-teal-400 to-cyan-400',
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="group bg-white p-8 rounded-2xl border border-neutral-200 shadow-soft hover:shadow-soft-lg hover:border-teal-200 transition-all duration-500 hover:-translate-y-2"
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-6 shadow-soft group-hover:scale-110 group-hover:shadow-glow transition-all duration-300`}>
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-navy-800 mb-3 group-hover:text-teal-700 transition-colors">
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

      {/* Social Proof / Stats Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 199, 199, 0.5) 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Trusted by Life Sciences Professionals</h2>
            <p className="text-neutral-400">Powering deal analysis for biotech and pharma</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '500+', label: 'Deals Analyzed' },
              { value: '$2B+', label: 'Deal Value Estimated' },
              { value: '50+', label: 'Companies Served' },
              { value: '99%', label: 'User Satisfaction' },
            ].map((stat, idx) => (
              <div key={idx} className="text-center group">
                <div className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400 mb-2 group-hover:scale-110 transition-transform duration-300">
                  {stat.value}
                </div>
                <div className="text-neutral-400 text-sm font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-4 bg-white scroll-mt-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-navy-50 border border-navy-200 rounded-full px-4 py-1.5 mb-6">
            <span className="text-sm font-medium text-navy-700">About Us</span>
          </div>
          <h2 className="text-4xl font-bold text-navy-800 mb-6">
            Ambrosia Ventures
          </h2>
          <p className="text-xl text-neutral-600 mb-10 leading-relaxed">
            A boutique strategy and M&A advisory firm specializing in life sciences.
            We help biotech companies, pharmaceutical corporate development teams, and investors
            navigate licensing deals, M&A transactions, and strategic partnerships.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {['Licensing Strategy', 'M&A Advisory', 'In/Out-Licensing', 'Deal Structuring', 'Valuation'].map((service, idx) => (
              <span
                key={idx}
                className="px-5 py-2.5 bg-neutral-50 rounded-xl text-navy-700 text-sm font-medium border border-neutral-200
                         hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 transition-all duration-300 cursor-default"
              >
                {service}
              </span>
            ))}
          </div>
          <a
            href="https://www.ambrosiaventures.co"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary group"
          >
            Visit Our Website
            <svg className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-900 text-neutral-400 py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-8 pb-12 border-b border-navy-800">
            <div className="flex items-center gap-4">
              <Image
                src="/logo.png"
                alt="Ambrosia Ventures"
                width={220}
                height={60}
                className="h-14 w-auto object-contain brightness-0 invert opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>
            <nav className="flex items-center gap-8 text-sm">
              {[
                { label: 'Website', href: 'https://www.ambrosiaventures.co', external: true },
                { label: 'Contact', href: 'mailto:info@ambrosiaventures.co', external: false },
                { label: 'LinkedIn', href: 'https://www.linkedin.com/company/ambrosia-ventures', external: true },
                { label: 'Instagram', href: 'https://instagram.com/ambrosiaventures', external: true },
              ].map((link, idx) => (
                <a
                  key={idx}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className="hover:text-teal-400 transition-colors duration-300 relative group"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-teal-400 group-hover:w-full transition-all duration-300" />
                </a>
              ))}
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
