'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-soft border-b border-neutral-100'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-44 lg:h-72">
          <a
            href="https://www.ambrosiaventures.co"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center group"
          >
            <Image
              src="/logo.png"
              alt="Ambrosia Ventures"
              width={900}
              height={248}
              className="h-36 sm:h-52 lg:h-64 w-auto object-contain transition-all duration-300 hover:opacity-80"
              priority
            />
          </a>

          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#calculator"
              className="text-sm font-medium text-neutral-600 hover:text-teal-600 transition-colors"
            >
              Calculator
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-neutral-600 hover:text-teal-600 transition-colors"
            >
              Pricing
            </a>
            <a
              href="#about"
              className="text-sm font-medium text-neutral-600 hover:text-teal-600 transition-colors"
            >
              About
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="mailto:info@ambrosiaventures.co"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200
                       bg-gradient-to-r from-teal-600 to-cyan-500 text-white hover:from-teal-700 hover:to-cyan-600 shadow-soft hover:shadow-glow hover:-translate-y-0.5"
            >
              <span>Get in Touch</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
