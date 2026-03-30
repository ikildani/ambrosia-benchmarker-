'use client';

import { useState, useEffect } from 'react';

interface TOCSection {
  id: string;
  label: string;
  number: number;
}

interface StickyTOCProps {
  sections: TOCSection[];
}

export function StickyTOC({ sections }: StickyTOCProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show TOC after scrolling past hero (400px)
      setIsVisible(window.scrollY > 400);

      // Find active section
      const scrollPos = window.scrollY + 120;
      let current = '';
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el && el.offsetTop <= scrollPos) {
          current = section.id;
        }
      }
      setActiveId(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  if (!isVisible) return null;

  return (
    <nav className="hidden xl:block fixed left-4 2xl:left-8 top-1/2 -translate-y-1/2 z-40 w-44">
      <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg p-3 shadow-sm">
        <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2">Contents</p>
        <ul className="space-y-1">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors ${
                  activeId === s.id
                    ? 'bg-teal-50 text-teal-700 font-semibold'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold ${
                  activeId === s.id ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {s.number}
                </span>
                <span className="leading-tight">{s.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
